import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ReviewState } from "../../../app/fixtureSession";
import type { ScreenDefinition, ScreenRole } from "../../../app/screenManifest";
import {
  Badge,
  Button,
  Dropzone,
  Field,
  Info,
  inputCls,
  PageHeader,
  Table,
  Td,
  Th,
} from "../../../components/ui";
import {
  ActionDialog,
  EmptyState,
  FilterBar,
  FixtureNotice,
  InlineMessage,
  LoadingState,
  SummaryStrip,
  WorkSection,
} from "../../../components/workspace";
import {
  loadFeedStore,
  loadFeedVouchers,
  postFeedVoucherV2,
  saveFeedAdjustmentV2,
  saveFeedVoucher,
  voidFeedPaymentV2,
  voidFeedVoucherV2,
  type FeedAdjustment,
  type FeedLine,
  type FeedStatus,
  type FeedStore,
  type FeedUnit,
  type FeedVoucher,
} from "../feedStore";

const money = (value: number) =>
  `${Math.round(value).toLocaleString("vi-VN")} đ`;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const previousMonthStart = () => {
  const [year, month] = today().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1, 12));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};
const roleLabel = (role?: ScreenRole) =>
  ({
    owner: "Chủ trại",
    manager: "Quản lý",
    technician: "Kỹ thuật viên",
    cs: "CS",
    pm: "PM",
    sa: "SA",
    guest: "Khách",
  })[role || "guest"];
const canWrite = (role?: ScreenRole, state?: ReviewState) =>
  (role === "owner" || role === "manager") && state !== "read-only";
function Shell({
  screen,
  role,
  actions,
  children,
}: {
  screen: ScreenDefinition;
  role?: ScreenRole;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title={screen.viTitle}
        sub={`Vai trò ${roleLabel(role)} · quản lý nhập kho và tồn thức ăn`}
        badge={<FixtureNotice />}
      >
        {actions}
      </PageHeader>
      {children}
    </div>
  );
}
function Guard({
  screen,
  role,
  children,
}: {
  screen: ScreenDefinition;
  role?: ScreenRole;
  children: ReactNode;
}) {
  return role === "owner" || role === "manager" ? (
    <>{children}</>
  ) : (
    <Shell screen={screen} role={role}>
      <InlineMessage tone="warn">
        Màn hình thức ăn chỉ dành cho Chủ trại hoặc Quản lý.
      </InlineMessage>
    </Shell>
  );
}
function State({
  state,
  children,
}: {
  state?: ReviewState;
  children: ReactNode;
}) {
  if (state === "loading")
    return <LoadingState label="Đang tải dữ liệu thức ăn…" />;
  if (state === "error")
    return (
      <InlineMessage tone="err">Không thể tải dữ liệu thức ăn.</InlineMessage>
    );
  if (state === "empty")
    return (
      <EmptyState
        title="Chưa có dữ liệu thức ăn"
        description="Tạo bản ghi đầu tiên hoặc đổi trạng thái để xem dữ liệu."
      />
    );
  return <>{children}</>;
}
const statusText = (item: { stockKg: number; minimumKg: number }) =>
  item.stockKg <= 0
    ? "Out of stock"
    : item.stockKg <= item.minimumKg
      ? "Low"
      : "Sufficient";
const statusLabel: Record<string, string> = {
  Sufficient: "Đủ dùng",
  Low: "Sắp hết",
  "Out of stock": "Đã hết",
};
const groupLabel: Record<string, string> = {
  "Green roughage": "Thức ăn thô xanh",
  Concentrate: "Thức ăn tinh",
  Mineral: "Khoáng chất",
  "Mineral – additive": "Khoáng và phụ gia",
  Supplement: "Thức ăn bổ sung",
};
const unitLabel: Record<string, string> = {
  KG: "kg",
  BAG: "bao",
  CAN: "can",
  BALE: "kiện",
};
const voucherStatusLabel: Record<FeedStatus | "ALL", string> = {
  ALL: "Tất cả",
  DRAFT: "Nháp",
  POSTED: "Đã ghi sổ",
  VOIDED: "Đã hủy",
};
const paymentStatusLabel: Record<string, string> = {
  ACTIVE: "Có hiệu lực",
  VOIDED: "Đã hủy",
};
const paymentMethodLabel: Record<string, string> = {
  BANK: "Chuyển khoản",
  CASH: "Tiền mặt",
};
const units = (item: {
  stockKg: number;
  purchaseUnitKg: number;
  purchaseUnit: string;
}) =>
  item.purchaseUnit === "KG"
    ? `${item.stockKg.toLocaleString("vi-VN")} kg`
    : `≈ ${(item.stockKg / Math.max(item.purchaseUnitKg, 1)).toFixed(1)} ${unitLabel[item.purchaseUnit] || item.purchaseUnit.toLowerCase()}`;
const lineAmount = (line: FeedLine) => line.quantity * line.unitPrice;
const newCode = (prefix: string, rows: Array<{ code: string }>) => {
  const year = new Date().getFullYear();
  const max = Math.max(
    0,
    ...rows.map((row) => Number(row.code.match(/(\d{4})$/)?.[1] || 0)),
  );
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
};

function Stock({
  screen,
  role,
  state,
}: {
  screen: ScreenDefinition;
  role?: ScreenRole;
  state?: ReviewState;
}) {
  const navigate = useNavigate();
  const [store, setStore] = useState<FeedStore>(() => loadFeedStore());
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [warehouse, setWarehouse] = useState("ALL");
  const [nearExpiry, setNearExpiry] = useState("ALL");
  const [movement, setMovement] = useState<string | null>(null);
  const nearestLot = (
    item: FeedStore["stock"][number],
    selectedWarehouse = "ALL",
  ) =>
    item.lots
      .filter(
        (lot) =>
          lot.quantityKg > 0 &&
          lot.expiryDate &&
          (selectedWarehouse === "ALL" || lot.warehouse === selectedWarehouse),
      )
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
  const isNearExpiry = (lot?: FeedStore["stock"][number]["lots"][number]) =>
    Boolean(
      lot &&
        Math.ceil(
          (Date.parse(`${lot.expiryDate}T23:59:59`) - Date.now()) / 86400000,
        ) <= 30,
    );
  const rows = useMemo(
    () =>
      store.stock.filter((item) => {
        const lot = nearestLot(item, warehouse);
        return (
          (!search ||
            `${item.code} ${item.name}`
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (group === "ALL" || item.group === group) &&
          (status === "ALL" || statusText(item) === status) &&
          (warehouse === "ALL" ||
            (item.warehouseQuantities[warehouse] || 0) > 0) &&
          (nearExpiry === "ALL" ||
            (nearExpiry === "YES" ? isNearExpiry(lot) : !isNearExpiry(lot)))
        );
      }),
    [store, search, group, status, warehouse, nearExpiry],
  );
  const low = store.stock.filter((item) => item.stockKg <= item.minimumKg);
  const stockValue = store.stock.reduce(
    (sum, item) => sum + item.stockKg * item.averageCost,
    0,
  );
  const movements = movement
    ? store.movements.filter((item) => item.feedId === movement)
    : [];
  return (
    <Guard screen={screen} role={role}>
      <Shell
        screen={screen}
        role={role}
        actions={
          <>
            <Button onClick={() => navigate("/ui/scr-113")}>
              Tạo phiếu nhập
            </Button>
            <Button variant="primary" onClick={() => navigate("/ui/scr-114")}>
              Kiểm kê / điều chỉnh
            </Button>
          </>
        }
      >
        <State state={state}>
          <FilterBar>
            <input
              className={inputCls}
              placeholder="Tìm mã hoặc thức ăn"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Tìm thức ăn"
            />
            <select
              className={inputCls}
              value={group}
              onChange={(event) => setGroup(event.target.value)}
              aria-label="Nhóm thức ăn"
            >
              <option value="ALL">Mọi nhóm</option>
              {[...new Set(store.stock.map((item) => item.group))].map(
                (item) => (
                  <option key={item} value={item}>
                    {groupLabel[item] || item}
                  </option>
                ),
              )}
            </select>
            <select
              className={inputCls}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Trạng thái tồn"
            >
              <option value="ALL">Mọi trạng thái</option>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className={inputCls}
              value={warehouse}
              onChange={(event) => setWarehouse(event.target.value)}
              aria-label="Kho"
            >
              <option value="ALL">Mọi kho</option>
              {[
                ...new Set(
                  store.stock.flatMap((item) =>
                    Object.keys(item.warehouseQuantities),
                  ),
                ),
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              className={inputCls}
              value={nearExpiry}
              onChange={(event) => setNearExpiry(event.target.value)}
              aria-label="Lô gần hết hạn"
            >
              <option value="ALL">Mọi hạn dùng</option>
              <option value="YES">Gần hết hạn (≤30 ngày)</option>
              <option value="NO">Không gần hết hạn</option>
            </select>
          </FilterBar>
          <SummaryStrip
            items={[
              {
                label: "Mặt hàng đang dùng",
                value: store.stock.filter((item) => item.status === "ACTIVE")
                  .length,
              },
              {
                label: "Sắp hết / đã hết",
                value: low.length,
                note: low.map((item) => item.code).join(", ") || "Không có",
              },
              { label: "Giá trị tồn kho", value: money(stockValue) },
              {
                label: "Mức dùng bình quân 7 ngày",
                value: `${store.stock.reduce((sum, item) => sum + item.averageDailyUseKg, 0)} kg/ngày`,
              },
            ]}
          />
          <WorkSection
            title="Tồn kho theo thức ăn"
            description="Tồn kho thay đổi khi ghi sổ phiếu nhập, điều chỉnh hoặc ghi nhận lần cho ăn; đơn vị chuẩn là kg."
          >
            <Table wide scroll>
              <thead>
                <tr>
                  <Th>Mã / thức ăn / nhóm</Th>
                  <Th>Kho</Th>
                  <Th>Tồn hiện tại</Th>
                  <Th>Mức tối thiểu</Th>
                  <Th>Bình quân/ngày</Th>
                  <Th>Ngày tồn</Th>
                  <Th>Lô gần hết hạn (≤30 ngày)</Th>
                  <Th>Trạng thái</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const lot = nearestLot(item, warehouse);
                  const nearLot = isNearExpiry(lot) ? lot : undefined;
                  const displayedKg =
                    warehouse === "ALL"
                      ? item.stockKg
                      : item.warehouseQuantities[warehouse] || 0;
                  return (
                    <tr key={item.id}>
                      <Td>
                        <strong>{item.code}</strong>
                        <br />
                        {item.name}
                        <br />
                        <span className="text-xs text-subtle">
                          {groupLabel[item.group] || item.group}
                        </span>
                      </Td>
                      <Td>
                        {warehouse === "ALL"
                          ? Object.entries(item.warehouseQuantities)
                              .map(([name, amount]) => `${name}: ${amount} kg`)
                              .join(" · ")
                          : warehouse}
                      </Td>
                      <Td>
                        {displayedKg.toLocaleString("vi-VN")} kg
                        <br />
                        <span className="text-xs text-subtle">
                          {units({ ...item, stockKg: displayedKg })}
                        </span>
                      </Td>
                      <Td>{item.minimumKg} kg</Td>
                      <Td>{item.averageDailyUseKg} kg</Td>
                      <Td>
                        {item.averageDailyUseKg
                          ? `${(displayedKg / item.averageDailyUseKg).toFixed(1)} ngày`
                          : "—"}
                      </Td>
                      <Td>
                        {nearLot
                          ? `${nearLot.code} · ${nearLot.expiryDate}`
                          : "—"}
                      </Td>
                      <Td>
                        <Badge
                          tone={
                            statusText(item) === "Sufficient" ? "ok" : "warn"
                          }
                        >
                          {statusLabel[statusText(item)]}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Button
                          small
                          disabled={!canWrite(role, state)}
                          onClick={() =>
                            navigate(`/ui/scr-113?feedId=${item.id}`)
                          }
                        >
                          Nhập
                        </Button>{" "}
                        <Button
                          small
                          onClick={() =>
                            setMovement(movement === item.id ? null : item.id)
                          }
                        >
                          Biến động
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <Td colSpan={9}>
                      <EmptyState
                        title="Không có thức ăn phù hợp"
                        description="Thử bỏ bộ lọc hoặc tạo phiếu nhập mới."
                      />
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
            {movement && (
              <div className="mt-4 border-y border-rule py-3">
                <strong className="text-sm">
                  Biến động ·{" "}
                  {store.stock.find((item) => item.id === movement)?.name ||
                    movement}
                </strong>
                <Table wide>
                  <thead>
                    <tr>
                      <Th>Thời gian</Th>
                      <Th>Loại</Th>
                      <Th>Số lượng kg</Th>
                      <Th>Đơn giá</Th>
                      <Th>Số dư sau</Th>
                      <Th>Nguồn chứng từ</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((item) => (
                      <tr key={item.id}>
                        <Td>{item.at}</Td>
                        <Td>{item.type}</Td>
                        <Td>{item.quantityKg}</Td>
                        <Td>{money(item.unitCost)}</Td>
                        <Td>{item.balanceAfterKg} kg</Td>
                        <Td>{item.sourceDocument}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
            <InlineMessage tone="info">
              Mức tối thiểu lấy từ danh mục; ngày tồn = tồn hiện tại ÷ mức dùng
              bình quân 7 ngày. Hệ thống nhắc khi tồn bằng hoặc thấp hơn mức tối
              thiểu.
            </InlineMessage>
          </WorkSection>
        </State>
      </Shell>
    </Guard>
  );
}

function Receipts({
  screen,
  role,
  state,
}: {
  screen: ScreenDefinition;
  role?: ScreenRole;
  state?: ReviewState;
}) {
  const navigate = useNavigate();
  const [store, setStore] = useState<FeedStore>(() => loadFeedStore());
  const [tab, setTab] = useState<FeedStatus | "ALL">("ALL");
  const [supplier, setSupplier] = useState("ALL");
  const [from, setFrom] = useState(previousMonthStart);
  const [to, setTo] = useState(today);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState<{
    type: "voucher" | "payment";
    row: FeedVoucher;
    paymentId?: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  const actionTriggerRef = useRef<HTMLElement | null>(null);
  const rows = store.vouchers.filter(
    (row) =>
      (tab === "ALL" || row.status === tab) &&
      (supplier === "ALL" || row.supplier === supplier) &&
      (!from || row.date >= from) &&
      (!to || row.date <= to),
  );
  const month = today().slice(0, 7);
  const received = store.vouchers.filter(
    (row) => row.status === "POSTED" && row.date.startsWith(month),
  );
  const owed = store.vouchers.filter(
    (row) => row.outstanding > 0 && row.status !== "VOIDED",
  );
  const suppliers = [
    ...new Set(store.vouchers.map((row) => row.supplier).filter(Boolean)),
  ];
  const openAction = (
    next: { type: "voucher" | "payment"; row: FeedVoucher; paymentId?: string },
    trigger?: HTMLElement | null,
  ) => {
    actionTriggerRef.current = trigger || null;
    setAction(next);
    setReason("");
    setActionError("");
    setError("");
  };
  const closeAction = () => {
    setAction(null);
    setReason("");
    setActionError("");
  };
  const submitAction = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setActionError("Nhập lý do để tiếp tục.");
      return;
    }
    if (!action) return;
    try {
      if (action.type === "voucher")
        voidFeedVoucherV2(action.row.id, trimmed, action.row.version);
      else
        voidFeedPaymentV2(
          action.row.id,
          action.paymentId || "",
          trimmed,
          action.row.version,
        );
      setStore(loadFeedStore());
      closeAction();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : action.type === "voucher"
            ? "Không thể hủy phiếu."
            : "Không thể hủy khoản thanh toán.",
      );
    }
  };
  return (
    <Guard screen={screen} role={role}>
      <Shell
        screen={screen}
        role={role}
        actions={
          <Button variant="primary" onClick={() => navigate("/ui/scr-113")}>
            Tạo phiếu nhập
          </Button>
        }
      >
        <State state={state}>
          <FilterBar>
            <div
              className="flex gap-1 border-b border-rule pb-2"
              role="tablist"
            >
              {(["ALL", "DRAFT", "POSTED", "VOIDED"] as const).map((item) => (
                <Button
                  key={item}
                  small
                  variant={tab === item ? "primary" : "default"}
                  onClick={() => setTab(item)}
                >
                  {voucherStatusLabel[item]} (
                  {
                    store.vouchers.filter(
                      (row) => item === "ALL" || row.status === item,
                    ).length
                  }
                  )
                </Button>
              ))}
            </div>
            <select
              className={inputCls}
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
              aria-label="Nhà cung cấp"
            >
              <option value="ALL">Mọi nhà cung cấp</option>
              {suppliers.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <label className="text-xs text-subtle">
              Từ ngày
              <input
                className={inputCls}
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                aria-label="Từ ngày"
              />
            </label>
            <label className="text-xs text-subtle">
              Đến ngày
              <input
                className={inputCls}
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                aria-label="Đến ngày"
              />
            </label>
          </FilterBar>
          <SummaryStrip
            items={[
              {
                label: "Nhập tháng này",
                value: `${received.reduce((sum, row) => sum + row.totalKg, 0)} kg · ${received.length} phiếu`,
              },
              {
                label: "Giá trị tháng này",
                value: money(
                  received.reduce((sum, row) => sum + row.totalAmount, 0),
                ),
              },
              {
                label: "Còn nợ nhà cung cấp",
                value: money(
                  owed.reduce((sum, row) => sum + row.outstanding, 0),
                ),
              },
              { label: "Nhà cung cấp đang hoạt động", value: suppliers.length },
            ]}
          />
          {error && <InlineMessage tone="err">{error}</InlineMessage>}
          <WorkSection title="Phiếu nhập thức ăn">
            <Table wide scroll>
              <thead>
                <tr>
                  <Th>Mã phiếu</Th>
                  <Th>Ngày · nhà cung cấp</Th>
                  <Th>Mặt hàng</Th>
                  <Th>Tổng kg</Th>
                  <Th>Tổng tiền</Th>
                  <Th>Còn nợ</Th>
                  <Th>Trạng thái</Th>
                  <Th>Thao tác</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={row.id}>
                    <tr>
                      <Td>
                        <button
                          className="font-semibold text-brand"
                          onClick={() => navigate(`/ui/scr-113?id=${row.id}`)}
                        >
                          {row.code}
                        </button>
                      </Td>
                      <Td>
                        {row.date}
                        <br />
                        {row.supplier}
                        <br />
                        <span className="text-xs text-subtle">
                          {row.invoiceNo || "Không có số hóa đơn"}
                        </span>
                      </Td>
                      <Td>
                        {row.lines.map((line) => line.feedName).join(", ") ||
                          "—"}
                      </Td>
                      <Td>{row.totalKg}</Td>
                      <Td>{money(row.totalAmount)}</Td>
                      <Td>{money(row.outstanding)}</Td>
                      <Td>
                        <Badge
                          tone={
                            row.status === "POSTED"
                              ? "ok"
                              : row.status === "VOIDED"
                                ? "err"
                                : "warn"
                          }
                        >
                          {voucherStatusLabel[row.status]}
                          {row.voidReason ? ` · ${row.voidReason}` : ""}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Button
                          small
                          onClick={() =>
                            setExpanded(expanded === row.id ? null : row.id)
                          }
                        >
                          {expanded === row.id
                            ? "Ẩn thanh toán"
                            : "Thanh toán / lịch sử"}
                        </Button>{" "}
                        {row.status === "DRAFT" && (
                          <Button
                            small
                            disabled={!canWrite(role, state)}
                            onClick={() => navigate(`/ui/scr-113?id=${row.id}`)}
                          >
                            Tiếp tục
                          </Button>
                        )}
                        {row.status !== "DRAFT" && (
                          <Button
                            small
                            onClick={() => navigate(`/ui/scr-113?id=${row.id}`)}
                          >
                            Xem
                          </Button>
                        )}
                        {row.status === "POSTED" && row.outstanding > 0 && (
                          <Button
                            small
                            disabled={!canWrite(role, state)}
                            onClick={() =>
                              navigate(
                                `/ui/scr-107?id=${row.id}&kind=FEED&returnTarget=/ui/scr-112`,
                              )
                            }
                          >
                            Ghi thêm
                          </Button>
                        )}
                        {row.status === "POSTED" && (
                          <Button
                            small
                            disabled={!canWrite(role, state)}
                            onClick={(event) =>
                              openAction(
                                { type: "voucher", row },
                                event.currentTarget,
                              )
                            }
                          >
                            Hủy
                          </Button>
                        )}
                      </Td>
                    </tr>
                    {expanded === row.id && (
                      <tr>
                        <Td colSpan={8}>
                          <div className="py-2">
                            <strong className="text-sm">
                              Lịch sử thanh toán
                            </strong>
                            {row.payments.length ? (
                              <div className="mt-2 divide-y border-y border-rule">
                                {row.payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="grid gap-2 py-3 md:grid-cols-7"
                                  >
                                    <span>
                                      <strong className="text-xs text-subtle">
                                        Ngày
                                      </strong>
                                      <br />
                                      {payment.date}
                                    </span>
                                    <span>
                                      <strong className="text-xs text-subtle">
                                        Số tiền
                                      </strong>
                                      <br />
                                      {money(payment.amount)}
                                    </span>
                                    <span>
                                      <strong className="text-xs text-subtle">
                                        Phương thức
                                      </strong>
                                      <br />
                                      {paymentMethodLabel[payment.method] ||
                                        payment.method}
                                    </span>
                                    <span>
                                      <strong className="text-xs text-subtle">
                                        Tham chiếu
                                      </strong>
                                      <br />
                                      {payment.reference || "—"}
                                    </span>
                                    <span>
                                      <strong className="text-xs text-subtle">
                                        Trạng thái
                                      </strong>
                                      <br />
                                      {paymentStatusLabel[payment.status] ||
                                        payment.status}
                                    </span>
                                    <span>
                                      <strong className="text-xs text-subtle">
                                        Lý do
                                      </strong>
                                      <br />
                                      {payment.voidReason || "—"}
                                    </span>
                                    <span>
                                      {payment.status === "ACTIVE" &&
                                        row.status === "POSTED" && (
                                          <Button
                                            small
                                            disabled={!canWrite(role, state)}
                                            onClick={(event) =>
                                              openAction(
                                                {
                                                  type: "payment",
                                                  row,
                                                  paymentId: payment.id,
                                                },
                                                event.currentTarget,
                                              )
                                            }
                                          >
                                            Hủy khoản thu
                                          </Button>
                                        )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <EmptyState
                                title="Chưa có khoản thanh toán"
                                description="Khoản trả ban đầu được tạo khi ghi sổ phiếu."
                              />
                            )}
                          </div>
                        </Td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!rows.length && (
                  <tr>
                    <Td colSpan={8}>
                      <EmptyState
                        title="Không có phiếu nhập"
                        description="Chọn tab khác hoặc tạo phiếu nhập mới."
                      />
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </WorkSection>
        </State>
        <ActionDialog
          returnFocusRef={actionTriggerRef}
          open={Boolean(action)}
          title={
            action?.type === "voucher"
              ? "Hủy phiếu nhập"
              : "Hủy khoản thanh toán"
          }
          description="Nhập lý do để lưu dấu vết và tiếp tục."
          error={actionError}
          confirmLabel="Xác nhận hủy"
          confirmTone="danger"
          onCancel={closeAction}
          onConfirm={submitAction}
        >
          <Field label="Lý do *">
            <textarea
              autoFocus
              className={`${inputCls} min-h-24`}
              maxLength={500}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setActionError("");
              }}
              placeholder="Ví dụ: nhập nhầm số lượng hoặc thanh toán trùng."
            />
          </Field>
        </ActionDialog>
      </Shell>
    </Guard>
  );
}

function ReceiptForm({
  screen,
  role,
  state,
}: {
  screen: ScreenDefinition;
  role?: ScreenRole;
  state?: ReviewState;
}) {
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const store = loadFeedStore();
  const requestedFeed = query.get("feedId");
  const initialFeed =
    store.stock.find((item) => item.id === requestedFeed) ||
    store.stock.find((item) => item.status === "ACTIVE");
  const existing = store.vouchers.find((row) => row.id === query.get("id"));
  const [voucher, setVoucher] = useState<FeedVoucher>(
    () =>
      existing || {
        id: `feed-${Date.now()}`,
        code: newCode("PNK", store.vouchers),
        status: "DRAFT",
        date: today(),
        supplier: "",
        invoiceNo: "",
        receivedBy: "",
        storageLocation: "",
        note: "",
        lines: initialFeed
          ? [
              {
                id: "line-initial",
                feedId: initialFeed.id,
                feedCode: initialFeed.code,
                feedName: initialFeed.name,
                lotNo: "",
                expiryDate: "",
                quantity: 1,
                unit: initialFeed.purchaseUnit,
                conversionKg: initialFeed.purchaseUnitKg,
                quantityKg: initialFeed.purchaseUnitKg,
                unitPrice: 0,
                amount: 0,
              },
            ]
          : [],
        attachments: [],
        transportFee: 0,
        totalKg: 0,
        goodsAmount: 0,
        totalAmount: 0,
        paid: 0,
        outstanding: 0,
        paymentMethod: "",
        dueDate: "",
        payments: [],
        history: ["Tạo phiếu nháp"],
        version: 1,
        updatedAt: new Date().toISOString(),
      },
  );
  const [error, setError] = useState("");
  const writable = canWrite(role, state) && voucher.status === "DRAFT";
  const activeFeed = store.stock.filter((item) => item.status === "ACTIVE");
  const recalc = (next: FeedVoucher) => {
    const lines = next.lines.map((line) => ({
      ...line,
      quantityKg: Number(line.quantity || 0) * Number(line.conversionKg || 1),
      amount: Number(line.quantity || 0) * Number(line.unitPrice || 0),
    }));
    const goodsAmount = lines.reduce((sum, line) => sum + line.amount, 0);
    return {
      ...next,
      lines,
      totalKg: lines.reduce((sum, line) => sum + line.quantityKg, 0),
      goodsAmount,
      totalAmount: goodsAmount + Number(next.transportFee || 0),
      outstanding: Math.max(
        goodsAmount + Number(next.transportFee || 0) - Number(next.paid || 0),
        0,
      ),
    };
  };
  const update = (patch: Partial<FeedVoucher>) =>
    setVoucher((current) => recalc({ ...current, ...patch }));
  const saveDraft = () => {
    if (
      !voucher.supplier ||
      !voucher.date ||
      voucher.date > today() ||
      !voucher.lines.length ||
      voucher.lines.some(
        (line) =>
          !line.feedId ||
          line.quantity <= 0 ||
          line.unitPrice < 0 ||
          (line.expiryDate && line.expiryDate <= voucher.date),
      )
    ) {
      setError(
        "Cần nhà cung cấp, ngày hợp lệ và dòng thức ăn đầy đủ; hạn dùng phải sau ngày nhập.",
      );
      return false;
    }
    if (
      !Number.isInteger(voucher.paid) ||
      voucher.paid < 0 ||
      voucher.paid > voucher.totalAmount ||
      (voucher.paid > 0 && !voucher.paymentMethod)
    ) {
      setError(
        "Đã trả phải là VND nguyên, không vượt tổng tiền; chọn phương thức khi đã trả.",
      );
      return false;
    }
    try {
      const current = loadFeedVouchers().find((row) => row.id === voucher.id);
      const saved = saveFeedVoucher(recalc(voucher), current?.version);
      setVoucher(saved);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu phiếu.");
      return false;
    }
  };
  const post = () => {
    if (!saveDraft()) return;
    try {
      const latest = loadFeedVouchers().find((row) => row.id === voucher.id);
      if (!latest) throw new Error("Không tìm thấy phiếu vừa lưu.");
      const posted = postFeedVoucherV2(latest.id, latest.version);
      setVoucher(posted);
      navigate("/ui/scr-112");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể ghi sổ phiếu.",
      );
    }
  };
  if (!writable && voucher.status !== "DRAFT" && state !== "read-only") {
    /* posted/voided remains a read-only detail */
  }
  return (
    <Guard screen={screen} role={role}>
      <Shell
        screen={screen}
        role={role}
        actions={
          <Button onClick={() => navigate("/ui/scr-112")}>
            Danh sách phiếu
          </Button>
        }
      >
        <State state={state}>
          <WorkSection
            title={`${voucher.status === "DRAFT" ? "Tạo / sửa" : "Chi tiết"} phiếu ${voucher.code}`}
            description="Phiếu đã ghi sổ hoặc đã hủy chỉ đọc; phiếu nháp chưa làm thay đổi tồn kho."
          >
            <Info
              items={[
                ["Mã phiếu", voucher.code],
                ["Trạng thái", voucherStatusLabel[voucher.status]],
                ["Tổng kg", `${voucher.totalKg} kg`],
                ["Tổng phải trả", money(voucher.totalAmount)],
                ["Còn nợ", money(voucher.outstanding)],
              ]}
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Ngày nhập *">
                <input
                  disabled={!writable}
                  className={inputCls}
                  type="date"
                  value={voucher.date}
                  max={today()}
                  onChange={(event) => update({ date: event.target.value })}
                />
              </Field>
              <Field label="Nhà cung cấp *">
                <select
                  disabled={!writable}
                  className={inputCls}
                  value={voucher.supplier}
                  onChange={(event) => update({ supplier: event.target.value })}
                >
                  <option value="">Chọn nhà cung cấp đang hoạt động</option>
                  {store.suppliers
                    .filter((supplier) => supplier.status === "ACTIVE")
                    .map((supplier) => (
                      <option key={supplier.id} value={supplier.name}>
                        {supplier.code} · {supplier.name}
                      </option>
                    ))}
                  {voucher.supplier &&
                    !store.suppliers.some(
                      (supplier) =>
                        supplier.name === voucher.supplier &&
                        supplier.status === "ACTIVE",
                    ) && (
                      <option value={voucher.supplier}>
                        {voucher.supplier} · đã ngừng hoạt động
                      </option>
                    )}
                </select>
              </Field>
              <Field label="Số hóa đơn / phiếu giao (≤50)">
                <input
                  disabled={!writable}
                  className={inputCls}
                  value={voucher.invoiceNo}
                  maxLength={50}
                  onChange={(event) =>
                    update({ invoiceNo: event.target.value })
                  }
                />
              </Field>
              <Field label="Người nhận (≤100)">
                <input
                  disabled={!writable}
                  className={inputCls}
                  value={voucher.receivedBy}
                  maxLength={100}
                  onChange={(event) =>
                    update({ receivedBy: event.target.value })
                  }
                />
              </Field>
              <Field label="Vị trí lưu kho (≤100)">
                <input
                  disabled={!writable}
                  className={inputCls}
                  value={voucher.storageLocation}
                  maxLength={100}
                  onChange={(event) =>
                    update({ storageLocation: event.target.value })
                  }
                />
              </Field>
              <Field label="Phí vận chuyển">
                <input
                  disabled={!writable}
                  className={inputCls}
                  type="number"
                  min="0"
                  value={voucher.transportFee}
                  onChange={(event) =>
                    update({ transportFee: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Ghi chú (≤1000)">
                <textarea
                  disabled={!writable}
                  className={`${inputCls} w-full`}
                  maxLength={1000}
                  value={voucher.note}
                  onChange={(event) => update({ note: event.target.value })}
                />
              </Field>
              <Field label="Tệp hóa đơn / phiếu giao">
                <input
                  disabled={!writable}
                  className={inputCls}
                  value={voucher.attachments.join(", ")}
                  onChange={(event) =>
                    update({
                      attachments: event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
            </div>
          </WorkSection>
          <WorkSection
            title="Mặt hàng thức ăn"
            actions={
              writable && (
                <Button
                  onClick={() =>
                    update({
                      lines: [
                        ...voucher.lines,
                        {
                          id: `line-${Date.now()}`,
                          feedId: activeFeed[0]?.id || "",
                          feedCode: activeFeed[0]?.code || "",
                          feedName: activeFeed[0]?.name || "",
                          lotNo: "",
                          expiryDate: "",
                          quantity: 1,
                          unit: activeFeed[0]?.purchaseUnit || "KG",
                          conversionKg: activeFeed[0]?.purchaseUnitKg || 1,
                          quantityKg: activeFeed[0]?.purchaseUnitKg || 1,
                          unitPrice: 0,
                          amount: 0,
                        },
                      ],
                    })
                  }
                >
                  + Thêm dòng
                </Button>
              )
            }
          >
            <Table wide scroll>
              <thead>
                <tr>
                  <Th>Thức ăn *</Th>
                  <Th>Lô / hạn dùng</Th>
                  <Th>Số lượng *</Th>
                  <Th>Đơn vị</Th>
                  <Th>Quy đổi kg</Th>
                  <Th>Đơn giá *</Th>
                  <Th>Thành tiền</Th>
                  <Th>Tồn trước → sau</Th>
                </tr>
              </thead>
              <tbody>
                {voucher.lines.map((line, index) => {
                  const item = activeFeed.find(
                    (feed) => feed.id === line.feedId,
                  );
                  const before = item?.stockKg || 0;
                  return (
                    <tr key={line.id}>
                      <Td>
                        <select
                          aria-label={`Thức ăn dòng ${index + 1}`}
                          disabled={!writable}
                          className={inputCls}
                          value={line.feedId}
                          onChange={(event) => {
                            const selected = activeFeed.find(
                              (feed) => feed.id === event.target.value,
                            );
                            const lines = voucher.lines.map((row, rowIndex) =>
                              rowIndex === index
                                ? {
                                    ...row,
                                    feedId: event.target.value,
                                    feedCode: selected?.code || "",
                                    feedName: selected?.name || "",
                                    unit: selected?.purchaseUnit || "KG",
                                    conversionKg: selected?.purchaseUnitKg || 1,
                                  }
                                : row,
                            );
                            update({ lines });
                          }}
                        >
                          {activeFeed.map((feed) => (
                            <option key={feed.id} value={feed.id}>
                              {feed.code} · {feed.name}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        <input
                          aria-label={`Số lô dòng ${index + 1}`}
                          disabled={!writable}
                          className={inputCls}
                          placeholder="Lô"
                          value={line.lotNo}
                          onChange={(event) =>
                            update({
                              lines: voucher.lines.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, lotNo: event.target.value }
                                  : row,
                              ),
                            })
                          }
                        />
                        <input
                          aria-label={`Hạn dùng dòng ${index + 1}`}
                          disabled={!writable}
                          className={inputCls}
                          type="date"
                          value={line.expiryDate}
                          onChange={(event) =>
                            update({
                              lines: voucher.lines.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, expiryDate: event.target.value }
                                  : row,
                              ),
                            })
                          }
                        />
                      </Td>
                      <Td>
                        <input
                          aria-label={`Số lượng dòng ${index + 1}`}
                          disabled={!writable}
                          className={inputCls}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(event) =>
                            update({
                              lines: voucher.lines.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      quantity: Number(event.target.value),
                                    }
                                  : row,
                              ),
                            })
                          }
                        />
                      </Td>
                      <Td>
                        <select
                          aria-label={`Đơn vị dòng ${index + 1}`}
                          disabled={!writable}
                          className={inputCls}
                          value={line.unit}
                          onChange={(event) => {
                            const unit = event.target.value as FeedUnit;
                            const selected = activeFeed.find(
                              (feed) => feed.id === line.feedId,
                            );
                            const conversionKg =
                              unit === "KG"
                                ? 1
                                : selected?.purchaseUnitKg ||
                                  line.conversionKg ||
                                  1;
                            update({
                              lines: voucher.lines.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, unit, conversionKg }
                                  : row,
                              ),
                            });
                          }}
                        >
                          {[
                            ...new Set<FeedUnit>([
                              "KG",
                              item?.purchaseUnit || line.unit,
                              line.unit,
                            ]),
                          ].map((unit) => (
                            <option key={unit} value={unit}>
                              {unit.toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        {line.quantityKg.toFixed(2)} kg ({line.conversionKg})
                      </Td>
                      <Td>
                        <input
                          aria-label={`Đơn giá dòng ${index + 1}`}
                          disabled={!writable}
                          className={inputCls}
                          type="number"
                          min="0"
                          step="1"
                          value={line.unitPrice}
                          onChange={(event) =>
                            update({
                              lines: voucher.lines.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      unitPrice: Number(event.target.value),
                                    }
                                  : row,
                              ),
                            })
                          }
                        />
                      </Td>
                      <Td>{money(line.amount)}</Td>
                      <Td>
                        {before} → {before + line.quantityKg} kg
                      </Td>
                    </tr>
                  );
                })}
                {!voucher.lines.length && (
                  <tr>
                    <Td colSpan={8}>
                      <EmptyState
                        title="Chưa có dòng thức ăn"
                        description="Thêm ít nhất một mặt hàng trước khi lưu."
                      />
                    </Td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <Td colSpan={2}>Tổng</Td>
                  <Td>{voucher.totalKg}</Td>
                  <Td />
                  <Td />
                  <Td />
                  <Td>{money(voucher.goodsAmount)}</Td>
                  <Td />
                </tr>
              </tfoot>
            </Table>
          </WorkSection>
          <WorkSection title="Thanh toán">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Đã thanh toán">
                <input
                  disabled={!writable}
                  className={inputCls}
                  type="number"
                  min="0"
                  max={voucher.totalAmount}
                  value={voucher.paid}
                  onChange={(event) =>
                    update({ paid: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Phương thức">
                <select
                  disabled={!writable}
                  className={inputCls}
                  value={voucher.paymentMethod}
                  onChange={(event) =>
                    update({
                      paymentMethod: event.target
                        .value as FeedVoucher["paymentMethod"],
                    })
                  }
                >
                  <option value="">Chọn</option>
                  <option value="BANK">Chuyển khoản</option>
                  <option value="CASH">Tiền mặt</option>
                </select>
              </Field>
              <Field label="Ngày đến hạn">
                <input
                  disabled={!writable}
                  className={inputCls}
                  type="date"
                  value={voucher.dueDate}
                  onChange={(event) => update({ dueDate: event.target.value })}
                />
              </Field>
            </div>
          </WorkSection>
          <WorkSection title="Thanh toán đã ghi nhận">
            <Table wide>
              <thead>
                <tr>
                  <Th>Ngày</Th>
                  <Th>Số tiền</Th>
                  <Th>Phương thức</Th>
                  <Th>Tham chiếu</Th>
                  <Th>Trạng thái</Th>
                  <Th>Lý do</Th>
                </tr>
              </thead>
              <tbody>
                {voucher.payments.map((payment) => (
                  <tr key={payment.id}>
                    <Td>{payment.date}</Td>
                    <Td>{money(payment.amount)}</Td>
                    <Td>
                      {paymentMethodLabel[payment.method] || payment.method}
                    </Td>
                    <Td>{payment.reference || "—"}</Td>
                    <Td>
                      {paymentStatusLabel[payment.status] || payment.status}
                    </Td>
                    <Td>{payment.voidReason || "—"}</Td>
                  </tr>
                ))}
                {!voucher.payments.length && (
                  <tr>
                    <Td colSpan={6}>
                      <EmptyState
                        title="Chưa có khoản thanh toán"
                        description="Thanh toán ban đầu được tạo khi ghi sổ."
                      />
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </WorkSection>
          {error && <InlineMessage tone="err">{error}</InlineMessage>}
          {voucher.status === "VOIDED" && (
            <InlineMessage tone="err">
              Lý do hủy: {voucher.voidReason}
            </InlineMessage>
          )}
          <div className="flex justify-end gap-2 border-t border-rule pt-4">
            <Button onClick={() => navigate("/ui/scr-112")}>Hủy</Button>
            {writable && (
              <>
                <Button onClick={saveDraft}>Lưu nháp</Button>
                <Button variant="primary" onClick={post}>
                  Lưu & cộng kho
                </Button>
              </>
            )}
          </div>
        </State>
      </Shell>
    </Guard>
  );
}

function Adjustment({
  screen,
  role,
  state,
}: {
  screen: ScreenDefinition;
  role?: ScreenRole;
  state?: ReviewState;
}) {
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const store = loadFeedStore();
  const existing = store.adjustments.find((row) => row.id === query.get("id"));
  const [adjustment, setAdjustment] = useState<FeedAdjustment>(
    () =>
      existing || {
        id: `adjustment-${Date.now()}`,
        code: newCode("ĐCK", store.adjustments),
        status: "DRAFT",
        countDate: today(),
        type: "PERIODIC_COUNT",
        countedBy: "",
        lines: store.stock
          .filter((item) => item.status === "ACTIVE")
          .map((item) => ({
            id: `${item.id}-count`,
            feedId: item.id,
            feedCode: item.code,
            feedName: item.name,
            systemKg: item.stockKg,
            systemVersion: item.version,
            countedKg: item.stockKg,
            differenceKg: 0,
            value: 0,
            reason: "",
            lotNo: item.lots[0]?.code,
            expiryDate: item.lots[0]?.expiryDate,
            warehouse: item.warehouse,
          })),
        attachments: [],
        history: ["Tạo phiếu kiểm kê nháp"],
        version: 1,
        updatedAt: new Date().toISOString(),
      },
  );
  const [error, setError] = useState("");
  const writable = canWrite(role, state) && adjustment.status === "DRAFT";
  const draftRows = store.adjustments.filter(
    (row) => row.status === "DRAFT" && row.id !== adjustment.id,
  );
  const updateLine = (
    index: number,
    patch: Partial<FeedAdjustment["lines"][number]>,
  ) =>
    setAdjustment((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              ...patch,
              differenceKg:
                Number(patch.countedKg ?? line.countedKg) - line.systemKg,
              value:
                (Number(patch.countedKg ?? line.countedKg) - line.systemKg) *
                (store.stock.find((item) => item.id === line.feedId)
                  ?.averageCost || 0),
            }
          : line,
      ),
    }));
  const save = (post: boolean) => {
    if (!adjustment.countDate) {
      setError("Nhập Ngày kiểm kê trước khi lưu phiếu.");
      return;
    }
    if (adjustment.countDate > today()) {
      setError("Ngày kiểm kê không được sau ngày hiện tại.");
      return;
    }
    if (!adjustment.countedBy.trim()) {
      setError("Nhập Người kiểm kê trước khi lưu phiếu.");
      return;
    }
    const missingReason = adjustment.lines.find(
      (line) => line.differenceKg !== 0 && !line.reason.trim(),
    );
    if (post && missingReason) {
      setError(
        `Nhập lý do chênh lệch cho ${missingReason.feedCode} · ${missingReason.feedName} trước khi ghi sổ.`,
      );
      return;
    }
    try {
      const saved = saveFeedAdjustmentV2(adjustment, post, adjustment.version);
      setAdjustment(saved);
      navigate(post ? "/ui/scr-111" : `/ui/scr-114?id=${saved.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể lưu điều chỉnh.",
      );
    }
  };
  return (
    <Guard screen={screen} role={role}>
      <Shell screen={screen} role={role}>
        <State state={state}>
          <WorkSection
            title={`${adjustment.status === "DRAFT" ? "Kiểm kê / điều chỉnh" : "Chi tiết"} ${adjustment.code}`}
            description="Tồn hệ thống là chỉ đọc tại ngày kiểm kê; phiếu điều chỉnh không sửa lịch sử nhập hoặc cho ăn."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Ngày kiểm kê *">
                <input
                  disabled={!writable}
                  className={inputCls}
                  type="date"
                  max={today()}
                  value={adjustment.countDate}
                  onChange={(event) =>
                    setAdjustment({
                      ...adjustment,
                      countDate: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Loại điều chỉnh *">
                <select
                  disabled={!writable}
                  className={inputCls}
                  value={adjustment.type}
                  onChange={(event) =>
                    setAdjustment({
                      ...adjustment,
                      type: event.target.value as FeedAdjustment["type"],
                    })
                  }
                >
                  <option value="PERIODIC_COUNT">Kiểm kê định kỳ</option>
                  <option value="LOSS">Hao hụt</option>
                  <option value="SPOILAGE">Hư hỏng</option>
                  <option value="OTHER">Khác</option>
                </select>
              </Field>
              <Field label="Người kiểm kê *">
                <input
                  disabled={!writable}
                  className={inputCls}
                  maxLength={200}
                  value={adjustment.countedBy}
                  onChange={(event) =>
                    setAdjustment({
                      ...adjustment,
                      countedBy: event.target.value,
                    })
                  }
                />
              </Field>
            </div>
            <Table wide scroll>
              <thead>
                <tr>
                  <Th>Thức ăn / lô / kho</Th>
                  <Th>Tồn hệ thống kg</Th>
                  <Th>Đếm thực tế kg *</Th>
                  <Th>Chênh lệch kg</Th>
                  <Th>Giá trị</Th>
                  <Th>Lý do nếu khác 0</Th>
                </tr>
              </thead>
              <tbody>
                {adjustment.lines.map((line, index) => (
                  <tr key={line.id}>
                    <Td>
                      {line.feedCode} · {line.feedName}
                      <br />
                      <span className="text-xs text-subtle">
                        {line.lotNo || "Tự phân bổ"} ·{" "}
                        {line.warehouse || "Kho mặc định"}
                      </span>
                    </Td>
                    <Td>{line.systemKg}</Td>
                    <Td>
                      <input
                        aria-label={`Số lượng thực đếm của ${line.feedName}`}
                        disabled={!writable}
                        className={inputCls}
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.countedKg}
                        onChange={(event) =>
                          updateLine(index, {
                            countedKg: Number(event.target.value),
                          })
                        }
                      />
                    </Td>
                    <Td>{line.differenceKg}</Td>
                    <Td>{money(line.value)}</Td>
                    <Td>
                      <input
                        aria-label={`Lý do điều chỉnh ${line.feedName}`}
                        disabled={!writable}
                        className={inputCls}
                        maxLength={500}
                        value={line.reason}
                        onChange={(event) =>
                          updateLine(index, { reason: event.target.value })
                        }
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <Td>Tổng</Td>
                  <Td />
                  <Td />
                  <Td>
                    {adjustment.lines.reduce(
                      (sum, line) => sum + line.differenceKg,
                      0,
                    )}
                  </Td>
                  <Td>
                    {money(
                      adjustment.lines.reduce(
                        (sum, line) => sum + line.value,
                        0,
                      ),
                    )}
                  </Td>
                  <Td />
                </tr>
              </tfoot>
            </Table>
            <div className="mt-4 border-y border-rule py-3">
              <strong className="text-sm">Bản nháp kiểm kê đang chờ</strong>
              {draftRows.length ? (
                <Table wide>
                  <thead>
                    <tr>
                      <Th>Mã</Th>
                      <Th>Ngày</Th>
                      <Th>Người kiểm kê</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {draftRows.map((row) => (
                      <tr key={row.id}>
                        <Td>{row.code}</Td>
                        <Td>{row.countDate}</Td>
                        <Td>{row.countedBy || "—"}</Td>
                        <Td>
                          <Button
                            small
                            onClick={() => navigate(`/ui/scr-114?id=${row.id}`)}
                          >
                            Tiếp tục
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <EmptyState
                  title="Không có nháp khác"
                  description="Bản nháp hiện tại được lưu và có thể tiếp tục sau."
                />
              )}
            </div>
            <Field label="Tệp kiểm kê / ảnh" hint="PDF, JPG hoặc PNG; dữ liệu xem trước chỉ lưu tên tệp trên thiết bị.">
              <div className="space-y-2">
                <Dropzone
                  disabled={!writable}
                  accept="application/pdf,image/jpeg,image/png"
                  hint="Kéo thả hoặc chọn biên bản kiểm kê, ảnh cân hay ảnh kho"
                  onFiles={(files) =>
                    setAdjustment((current) => ({
                      ...current,
                      attachments: Array.from(
                        new Set([
                          ...current.attachments,
                          ...files.map((file) => file.name),
                        ]),
                      ),
                    }))
                  }
                />
                {adjustment.attachments.length > 0 && (
                  <ul className="m-0 divide-y divide-rule border-y border-rule p-0">
                    {adjustment.attachments.map((name) => (
                      <li
                        key={name}
                        className="flex min-w-0 items-center gap-3 py-2 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate">{name}</span>
                        {writable && (
                          <Button
                            small
                            onClick={() =>
                              setAdjustment((current) => ({
                                ...current,
                                attachments: current.attachments.filter(
                                  (item) => item !== name,
                                ),
                              }))
                            }
                          >
                            Bỏ tệp
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>
            <div className="border-y border-rule py-3">
              <strong className="text-sm">Lịch sử</strong>
              {adjustment.history.map((item) => (
                <p key={item} className="m-0 mt-2 text-xs text-subtle">
                  {item}
                </p>
              ))}
            </div>
            <InlineMessage tone="info">
              Các phiếu nhập và lần cho ăn trước đó không bị thay đổi. Tồn chỉ
              đổi sau khi ghi sổ điều chỉnh.
            </InlineMessage>
            {error && <InlineMessage tone="err">{error}</InlineMessage>}
            <div className="flex justify-end gap-2 border-t border-rule pt-4">
              <Button onClick={() => navigate("/ui/scr-111")}>Hủy</Button>
              {writable && (
                <>
                  <Button onClick={() => save(false)}>Lưu nháp</Button>
                  <Button variant="primary" onClick={() => save(true)}>
                    Ghi sổ điều chỉnh
                  </Button>
                </>
              )}
            </div>
          </WorkSection>
        </State>
      </Shell>
    </Guard>
  );
}

export function FeedManagementScreen({
  screen,
  role,
  state = "success",
}: {
  screen: ScreenDefinition;
  role?: ScreenRole;
  state?: ReviewState;
}) {
  if (screen.id === "SCR-111")
    return <Stock screen={screen} role={role} state={state} />;
  if (screen.id === "SCR-112")
    return <Receipts screen={screen} role={role} state={state} />;
  if (screen.id === "SCR-113")
    return <ReceiptForm screen={screen} role={role} state={state} />;
  return <Adjustment screen={screen} role={role} state={state} />;
}
