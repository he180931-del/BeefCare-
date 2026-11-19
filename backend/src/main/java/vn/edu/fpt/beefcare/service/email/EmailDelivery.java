package vn.edu.fpt.beefcare.service.email;

/** Provider boundary for transactional email. Provider implementations are selected by configuration/profile. */
public interface EmailDelivery {
    void deliver(OutboundEmail message);
}
