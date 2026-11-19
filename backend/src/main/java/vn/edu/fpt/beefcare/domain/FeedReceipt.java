package vn.edu.fpt.beefcare.domain;

import jakarta.persistence.*;
import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "feed_receipt", uniqueConstraints = @UniqueConstraint(name="uq_feed_receipt_farm_code", columnNames={"farm_id","code"}))
public class FeedReceipt implements Serializable {
    @Serial private static final long serialVersionUID=1L;
    @Id @GeneratedValue(strategy=GenerationType.SEQUENCE,generator="sequenceGenerator") @SequenceGenerator(name="sequenceGenerator") private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="farm_id",nullable=false) private Farm farm;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="supplier_id",nullable=false) private TradingPartner supplier;
    @Column(name="code",length=40,nullable=false) private String code;
    @Column(name="receipt_date",nullable=false) private LocalDate receiptDate;
    @Column(name="invoice_number",length=50) private String invoiceNumber;
    @Column(name="received_by",length=100) private String receivedBy;
    @Column(name="storage_location",length=100) private String storageLocation;
    @Column(name="note",length=1000) private String note;
    @Column(name="transport_fee",nullable=false) private Long transportFee=0L;
    @Column(name="total_payable",nullable=false) private Long totalPayable=0L;
    @Column(name="status",length=20,nullable=false) private String status="DRAFT";
    @Column(name="void_reason",length=500) private String voidReason;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="created_by_id") private AppUser createdBy;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    @Column(name="posted_at") private Instant postedAt;
    @Version @Column(name="version",nullable=false) private Integer version=0;
    public Long getId(){return id;} public Farm getFarm(){return farm;} public void setFarm(Farm v){farm=v;}
    public TradingPartner getSupplier(){return supplier;} public void setSupplier(TradingPartner v){supplier=v;}
    public String getCode(){return code;} public void setCode(String v){code=v;} public LocalDate getReceiptDate(){return receiptDate;} public void setReceiptDate(LocalDate v){receiptDate=v;}
    public String getInvoiceNumber(){return invoiceNumber;} public void setInvoiceNumber(String v){invoiceNumber=v;} public String getReceivedBy(){return receivedBy;} public void setReceivedBy(String v){receivedBy=v;}
    public String getStorageLocation(){return storageLocation;} public void setStorageLocation(String v){storageLocation=v;} public String getNote(){return note;} public void setNote(String v){note=v;}
    public Long getTransportFee(){return transportFee;} public void setTransportFee(Long v){transportFee=v;} public Long getTotalPayable(){return totalPayable;} public void setTotalPayable(Long v){totalPayable=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;} public String getVoidReason(){return voidReason;} public void setVoidReason(String v){voidReason=v;}
    public AppUser getCreatedBy(){return createdBy;} public void setCreatedBy(AppUser v){createdBy=v;} public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant v){createdAt=v;}
    public Instant getPostedAt(){return postedAt;} public void setPostedAt(Instant v){postedAt=v;} public Integer getVersion(){return version;}
}
