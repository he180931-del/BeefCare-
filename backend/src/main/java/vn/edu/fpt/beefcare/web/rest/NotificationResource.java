package vn.edu.fpt.beefcare.web.rest;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.NotificationService;
import vn.edu.fpt.beefcare.service.NotificationService.NotificationView;

/** FE-14 recipient-only notification inbox; writes cannot select or impersonate a recipient. */
@RestController
@RequestMapping("/api/notifications")
public class NotificationResource {
    private final NotificationService service;
    public NotificationResource(NotificationService service){this.service=service;}

    @GetMapping("/mine")
    public List<NotificationView> mine(){return service.mine();}

    @PutMapping("/{id}/read")
    public ResponseEntity<NotificationView> markRead(@PathVariable Long id){return ResponseEntity.ok(service.markRead(id));}

    @PutMapping("/read-all")
    public ResponseEntity<Integer> markAllAsRead(){return ResponseEntity.ok(service.markAllAsRead());}
}
