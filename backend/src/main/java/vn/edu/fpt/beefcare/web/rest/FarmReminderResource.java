package vn.edu.fpt.beefcare.web.rest;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.FarmReminderQueryService;
import vn.edu.fpt.beefcare.service.FarmReminderQueryService.ReminderView;

/** Read-only tenant-scoped farm reminder list. */
@RestController
@RequestMapping("/api/farms/{farmId}/reminders")
public class FarmReminderResource {
    private final FarmReminderQueryService reminders;
    public FarmReminderResource(FarmReminderQueryService reminders){this.reminders=reminders;}
    @GetMapping public List<ReminderView> mine(@PathVariable Long farmId){return reminders.mine(farmId);}
}
