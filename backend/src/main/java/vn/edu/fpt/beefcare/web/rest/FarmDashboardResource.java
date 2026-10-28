package vn.edu.fpt.beefcare.web.rest;

import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.FarmDashboardService;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.DashboardRequest;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.DashboardView;
import vn.edu.fpt.beefcare.service.FarmReportService;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportRequest;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportView;
import java.util.List;

/** Owner / Manager farm dashboard projections; the service enforces tenant and role access. */
@RestController
@RequestMapping("/api/farms/{farmId}/dashboard")
public class FarmDashboardResource {
    private final FarmDashboardService dashboards;
    private final FarmReportService reports;
    public FarmDashboardResource(FarmDashboardService dashboards,FarmReportService reports){this.dashboards=dashboards;this.reports=reports;}

    @GetMapping
    public DashboardView getDashboard(
        @PathVariable Long farmId,
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(required=false) Long penId,
        @RequestParam(required=false) String herdGroup,
        @RequestParam(required=false) String lifeStage
    ){
        return dashboards.dashboard(farmId,new DashboardRequest(from,to,penId,herdGroup,lifeStage));
    }

    @org.springframework.web.bind.annotation.PostMapping("/reports")
    public ReportView report(@PathVariable Long farmId,@org.springframework.web.bind.annotation.RequestBody ReportRequest request){
        return reports.report(farmId,request);
    }
}
