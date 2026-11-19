package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name="feed_ration_version",uniqueConstraints=@UniqueConstraint(name="uq_feed_ration_version",columnNames={"farm_id","ration_code","version_no"}))
public class FeedRationVersion implements Serializable {
    @Serial private static final long serialVersionUID=1L;
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="farm_id",nullable=false) private Farm farm;
    @Column(name="ration_code",length=30,nullable=false) private String rationCode;
    @Column(name="version_no",nullable=false) private Integer versionNo;
    @Column(name="name",length=100,nullable=false) private String name;
    @Column(name="herd_group",length=30) private String herdGroup;
    @Column(name="basis",length=500) private String basis;
    @Column(name="effective_from",nullable=false) private LocalDate effectiveFrom;
    @Column(name="effective_to") private LocalDate effectiveTo;
    @Column(name="status",length=20,nullable=false) private String status="SCHEDULED";
    @Column(name="sessions_per_day",nullable=false) private Integer sessionsPerDay;
    @Column(name="session_times",length=30,nullable=false) private String sessionTimes;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="created_by_id") private AppUser createdBy;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    public Long getId(){return id;} public Farm getFarm(){return farm;} public void setFarm(Farm v){farm=v;} public String getRationCode(){return rationCode;} public void setRationCode(String v){rationCode=v;}
    public Integer getVersionNo(){return versionNo;} public void setVersionNo(Integer v){versionNo=v;} public String getName(){return name;} public void setName(String v){name=v;}
    public String getHerdGroup(){return herdGroup;} public void setHerdGroup(String v){herdGroup=v;} public String getBasis(){return basis;} public void setBasis(String v){basis=v;}
    public LocalDate getEffectiveFrom(){return effectiveFrom;} public void setEffectiveFrom(LocalDate v){effectiveFrom=v;} public LocalDate getEffectiveTo(){return effectiveTo;} public void setEffectiveTo(LocalDate v){effectiveTo=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;} public Integer getSessionsPerDay(){return sessionsPerDay;} public void setSessionsPerDay(Integer v){sessionsPerDay=v;}
    public String getSessionTimes(){return sessionTimes;} public void setSessionTimes(String v){sessionTimes=v;} public AppUser getCreatedBy(){return createdBy;} public void setCreatedBy(AppUser v){createdBy=v;}
    public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant v){createdAt=v;}
}
