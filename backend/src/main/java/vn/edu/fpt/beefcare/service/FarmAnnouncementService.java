package vn.edu.fpt.beefcare.service;

import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.*;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.*;

/** FE-07 draft, publication, correction history and recipient delivery snapshot commands. */
@Service
public class FarmAnnouncementService {
    private static final String ACTIVE="ACTIVE";
    private final FarmAccessService access;private final FarmClock clock;private final FarmMembershipRepository memberships;
    private final FarmAnnouncementRepository announcements;private final AnnouncementVersionRepository versions;
    private final AnnouncementRecipientRepository recipients;private final OutboxService outbox;
    public FarmAnnouncementService(FarmAccessService access,FarmClock clock,FarmMembershipRepository memberships,
        FarmAnnouncementRepository announcements,AnnouncementVersionRepository versions,AnnouncementRecipientRepository recipients,OutboxService outbox){
        this.access=access;this.clock=clock;this.memberships=memberships;this.announcements=announcements;this.versions=versions;this.recipients=recipients;this.outbox=outbox;
    }

    @Transactional(readOnly=true)
    public List<AnnouncementView> list(Long farmId){
        FarmContext ctx=access.require(farmId,FarmAction.VIEW_ANNOUNCEMENTS);FarmMembership member=membership(farmId,ctx.user().getId());Map<Long,AnnouncementView> result=new LinkedHashMap<>();
        for(FarmAnnouncement a:announcements.findByFarm_IdOrderByIdDesc(farmId))if(a.getAuthor().getId().equals(member.getId()))result.put(a.getId(),view(a,true,member));
        for(AnnouncementRecipient r:recipients.findByMembership_IdOrderByDeliveredTimeDesc(member.getId())){FarmAnnouncement a=r.getVersion().getAnnouncement();if(a.getFarm().getId().equals(farmId))result.putIfAbsent(a.getId(),view(a,false,member));}
        return List.copyOf(result.values());
    }

    @Transactional
    public AnnouncementView createDraft(Long farmId,DraftRequest request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_ANNOUNCEMENTS);List<String> roleNames=validateRecipients(ctx.role(),request.recipientRoles());FarmMembership author=membership(farmId,ctx.user().getId());
        FarmAnnouncement a=new FarmAnnouncement();a.setFarm(ctx.farm());a.setAuthor(author);a.setState("DRAFT");a.setDraftTitle(request.title().trim());a.setDraftBody(request.body().trim());a.setRecipientRoles(String.join(",",roleNames));announcements.saveAndFlush(a);
        return view(a,true,author);
    }

    @Transactional
    public AnnouncementView updateDraft(Long farmId,Long id,DraftRequest request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_ANNOUNCEMENTS);FarmMembership author=membership(farmId,ctx.user().getId());FarmAnnouncement a=load(farmId,id);requireAuthor(a,author);if(!"DRAFT".equals(a.getState()))throw DomainException.conflict(MessageCodes.COM_05,"reason","draft_already_published");VersionGuard.requireExpected(a.getVersion(),request.expectedVersion());
        a.setDraftTitle(request.title().trim());a.setDraftBody(request.body().trim());a.setRecipientRoles(String.join(",",validateRecipients(ctx.role(),request.recipientRoles())));announcements.saveAndFlush(a);return view(a,true,author);
    }

    @Transactional
    public AnnouncementView publish(Long farmId,Long id,PublishRequest request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_ANNOUNCEMENTS);FarmMembership author=membership(farmId,ctx.user().getId());FarmAnnouncement a=load(farmId,id);requireAuthor(a,author);VersionGuard.requireExpected(a.getVersion(),request.expectedVersion());if(!"DRAFT".equals(a.getState()))throw DomainException.conflict(MessageCodes.COM_05);
        AnnouncementVersion version=publishVersion(ctx,a,author,null);a.setState("PUBLISHED");announcements.saveAndFlush(a);return view(a,true,author);
    }

    @Transactional
    public AnnouncementView correctPublished(Long farmId,Long id,CorrectionRequest request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_ANNOUNCEMENTS);FarmMembership author=membership(farmId,ctx.user().getId());FarmAnnouncement a=load(farmId,id);requireAuthor(a,author);VersionGuard.requireExpected(a.getVersion(),request.expectedVersion());if(!"PUBLISHED".equals(a.getState()))throw DomainException.conflict(MessageCodes.COM_05);
        a.setDraftTitle(request.title().trim());a.setDraftBody(request.body().trim());announcements.saveAndFlush(a);publishVersion(ctx,a,author,request.reason().trim());return view(a,true,author);
    }

    @Transactional
    public ReadResult markRead(Long farmId,Long recipientId){FarmContext ctx=access.require(farmId,FarmAction.VIEW_ANNOUNCEMENTS);FarmMembership member=membership(farmId,ctx.user().getId());AnnouncementRecipient item=recipients.findByIdAndMembership_Id(recipientId,member.getId()).filter(r->r.getVersion().getAnnouncement().getFarm().getId().equals(farmId)).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));if(item.getReadTime()==null)item.setReadTime(clock.now());AnnouncementRecipient saved=recipients.save(item);return new ReadResult(saved.getId(),saved.getReadTime());}

    private AnnouncementVersion publishVersion(FarmContext ctx,FarmAnnouncement a,FarmMembership author,String correctionReason){
        if(a.getDraftTitle()==null||a.getDraftTitle().isBlank()||a.getDraftBody()==null||a.getDraftBody().isBlank())throw DomainException.required("content");
        List<FarmMembership> targets;
        if(correctionReason!=null){
            AnnouncementVersion previous=versions.findByAnnouncement_IdOrderByVersionNoDesc(a.getId()).stream().findFirst().orElseThrow(()->DomainException.conflict(MessageCodes.COM_05));
            targets=recipients.findByVersion_Id(previous.getId()).stream().map(AnnouncementRecipient::getMembership).distinct().toList();
        }else{
            List<String> audience=validateRecipients(ctx.role(),Arrays.asList(a.getRecipientRoles().split(",")));
            targets=memberships.findByFarm_IdAndStatusIgnoreCase(ctx.farmId(),ACTIVE).stream().filter(m->ACTIVE.equalsIgnoreCase(m.getStatus())).filter(m->!m.getId().equals(author.getId())).filter(m->{FarmRole role=FarmAccessService.parseRole(m.getRole());return role!=null&&audience.contains(role.name());}).toList();
        }
        if(targets.isEmpty())throw DomainException.unprocessable(MessageCodes.COM_10,"field","recipientRoles");
        int next=versions.findByAnnouncement_IdOrderByVersionNoDesc(a.getId()).stream().mapToInt(AnnouncementVersion::getVersionNo).max().orElse(0)+1;
        Instant now=clock.now();AnnouncementVersion version=new AnnouncementVersion();version.setAnnouncement(a);version.setVersionNo(next);version.setTitle(a.getDraftTitle());version.setBody(a.getDraftBody());version.setPublishedTime(now);version.setCorrectionReason(correctionReason);versions.saveAndFlush(version);
        for(FarmMembership target:targets){AnnouncementRecipient recipient=new AnnouncementRecipient();recipient.setVersion(version);recipient.setMembership(target);recipient.setDeliveredTime(now);recipients.save(recipient);}
        outbox.enqueue(ctx.farmId(),correctionReason==null?"ANNOUNCEMENT_PUBLISHED":"ANNOUNCEMENT_CORRECTED","AnnouncementVersion",version.getId(),Map.of("announcementId",a.getId(),"versionId",version.getId(),"recipientCount",targets.size()));return version;
    }

    private AnnouncementView view(FarmAnnouncement a,boolean authorView,FarmMembership member){
        boolean canSeeDraft=authorView&&a.getAuthor().getId().equals(member.getId());String title=canSeeDraft?a.getDraftTitle():null;String body=canSeeDraft?a.getDraftBody():null;
        Map<Long,AnnouncementRecipient> delivered=new HashMap<>();for(AnnouncementRecipient r:recipients.findByMembership_IdOrderByDeliveredTimeDesc(member.getId()))if(r.getVersion().getAnnouncement().getId().equals(a.getId()))delivered.put(r.getVersion().getId(),r);
        List<VersionView> history=versions.findByAnnouncement_IdOrderByVersionNoDesc(a.getId()).stream().map(v->{AnnouncementRecipient r=delivered.get(v.getId());boolean own=authorView&&a.getAuthor().getId().equals(member.getId());if(!own&&r==null)return null;return new VersionView(v.getId(),v.getVersionNo(),v.getTitle(),v.getBody(),v.getPublishedTime(),v.getCorrectionReason(),r!=null&&r.getReadTime()==null);}).filter(Objects::nonNull).toList();
        return new AnnouncementView(a.getId(),a.getState(),a.getAuthor().getUser().getFullName(),title,body,a.getVersion(),history);
    }
    private FarmAnnouncement load(Long farmId,Long id){return announcements.findByIdAndFarm_Id(id,farmId).orElseThrow(()->DomainException.notFound(MessageCodes.COM_08));}
    private FarmMembership membership(Long farmId,Long userId){return memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(farmId,userId,ACTIVE).orElseThrow(()->DomainException.forbidden(MessageCodes.COM_01));}
    private void requireAuthor(FarmAnnouncement a,FarmMembership author){if(!a.getAuthor().getId().equals(author.getId()))throw DomainException.forbidden(MessageCodes.COM_01);}
    private List<String> validateRecipients(FarmRole author,List<String> requested){Set<String> allowed=author==FarmRole.OWNER?Set.of("MANAGER","TECHNICIAN"):Set.of("TECHNICIAN");List<String> values=requested.stream().filter(Objects::nonNull).map(FarmAccessService::parseRole).filter(Objects::nonNull).map(FarmRole::name).distinct().sorted().toList();if(values.isEmpty()||!allowed.containsAll(values))throw DomainException.forbidden(MessageCodes.COM_01);return values;}
}
