[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$Apply,
    [string]$BaseUrl = $(if ($env:BEEFCARE_LOCAL_API_BASE_URL) { $env:BEEFCARE_LOCAL_API_BASE_URL } else { 'http://127.0.0.1:8080' }),
    [long]$FarmId = $(if ($env:BEEFCARE_LOCAL_FARM_ID) { [long]$env:BEEFCARE_LOCAL_FARM_ID } else { 0 }),
    [long]$SupplierId = $(if ($env:BEEFCARE_LOCAL_SUPPLIER_ID) { [long]$env:BEEFCARE_LOCAL_SUPPLIER_ID } else { 0 }),
    [long]$FeedItemId = $(if ($env:BEEFCARE_LOCAL_FEED_ITEM_ID) { [long]$env:BEEFCARE_LOCAL_FEED_ITEM_ID } else { 0 }),
    [long]$PenId = $(if ($env:BEEFCARE_LOCAL_PEN_ID) { [long]$env:BEEFCARE_LOCAL_PEN_ID } else { 0 }),
    [string]$CookieHeader = $env:BEEFCARE_LOCAL_COOKIE_HEADER,
    [string]$CsrfHeaderName = $env:BEEFCARE_LOCAL_CSRF_HEADER_NAME,
    [string]$CsrfToken = $env:BEEFCARE_LOCAL_CSRF_TOKEN,
    [string]$SeedIdentity = $(if ($env:BEEFCARE_LOCAL_SEED_IDENTITY) { $env:BEEFCARE_LOCAL_SEED_IDENTITY } else { 'beefcare-local-demo-feed-v1' }),
    [string]$InvoiceNumber = $(if ($env:BEEFCARE_LOCAL_SEED_INVOICE) { $env:BEEFCARE_LOCAL_SEED_INVOICE } else { 'BC-LOCAL-DEMO-FEED-001' }),
    [string]$RationCode = $(if ($env:BEEFCARE_LOCAL_SEED_RATION_CODE) { $env:BEEFCARE_LOCAL_SEED_RATION_CODE } else { 'BC-DEMO-RATION-01' }),
    [string]$RationName = $env:BEEFCARE_LOCAL_SEED_RATION_NAME,
    [string]$ReceiptDate = $env:BEEFCARE_LOCAL_SEED_RECEIPT_DATE,
    [string]$FeedingDate = $env:BEEFCARE_LOCAL_SEED_FEEDING_DATE,
    [int]$SessionNo = 1,
    [decimal]$QuantityPurchase = 0,
    [long]$UnitPrice = 0,
    [decimal]$Session1Kg = 0,
    [decimal]$ActualKg = 0,
    [string]$PurchaseUnit = $env:BEEFCARE_LOCAL_SEED_PURCHASE_UNIT,
    [string]$SessionTime = $env:BEEFCARE_LOCAL_SEED_SESSION_TIME
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Stop-Seed([string]$Message) { throw "[beefcare-local-demo-seed] $Message" }
function Assert-PositiveId([long]$Value, [string]$Name) {
    if ($Value -le 0) { Stop-Seed "$Name is required and must be a positive local ID." }
}
function Assert-LocalUrl([uri]$Uri) {
    if ($null -eq $Uri -or -not $Uri.IsAbsoluteUri) { Stop-Seed 'BaseUrl must be an absolute URL.' }
    $normalizedHost = $Uri.IdnHost.ToLowerInvariant()
    $allowedHosts = @('127.0.0.1', 'localhost', '::1')
    if ([string]$Uri.OriginalString -match '%' -or $Uri.Scheme -cne 'http' -or $allowedHosts -notcontains $normalizedHost -or
        $Uri.AbsolutePath -ne '/' -or -not [string]::IsNullOrEmpty($Uri.Query) -or
        -not [string]::IsNullOrEmpty($Uri.Fragment) -or -not [string]::IsNullOrEmpty($Uri.UserInfo)) {
        Stop-Seed "Refusing BaseUrl '$Uri'. Only http loopback root URLs without query, fragment, or userinfo are allowed."
    }
}
function Api-Uri([string]$Path) { return [uri](($root.AbsoluteUri.TrimEnd('/')) + $Path) }
function Require-Field($Object, [string]$Name, [string]$Label) {
    if ($null -eq $Object -or @($Object.PSObject.Properties.Name) -notcontains $Name -or $null -eq $Object.$Name) {
        Stop-Seed "$Label response is missing '$Name'."
    }
}
function Assert-WriteResult($Response, [string]$Label) {
    if ($null -eq $Response -or @($Response.PSObject.Properties.Name) -contains '__skippedByWhatIf') {
        Stop-Seed "$Label was skipped by -WhatIf; no write was attempted."
    }
}
function Assert-DecimalEqual($Actual, $Expected, [string]$Label) {
    try {
        if ([decimal]$Actual -ne [decimal]$Expected) { Stop-Seed "$Label does not match the requested value." }
    } catch { Stop-Seed "$Label is not a comparable number." }
}
function Assert-TextEqual($Actual, $Expected, [string]$Label) {
    if ([string]$Actual -cne [string]$Expected) { Stop-Seed "$Label does not match the requested value." }
}
function Assert-IdListEqual([object[]]$Actual, [object[]]$Expected, [string]$Label) {
    $actualIds = @($Actual | ForEach-Object { [long]$_ } | Sort-Object)
    $expectedIds = @($Expected | ForEach-Object { [long]$_ } | Sort-Object)
    if ($actualIds.Count -ne $expectedIds.Count -or (Compare-Object -ReferenceObject $expectedIds -DifferenceObject $actualIds)) {
        Stop-Seed "$Label does not match the requested IDs."
    }
}
function Assert-TextListEqual([object[]]$Actual, [object[]]$Expected, [string]$Label) {
    $actualValues = @($Actual | ForEach-Object { [string]$_ })
    $expectedValues = @($Expected | ForEach-Object { [string]$_ })
    if ($actualValues.Count -ne $expectedValues.Count) { Stop-Seed "$Label does not match the requested values." }
    for ($i = 0; $i -lt $expectedValues.Count; $i++) { Assert-TextEqual $actualValues[$i] $expectedValues[$i] "$Label[$i]" }
}
function Items($Response) {
    if ($null -eq $Response) { Stop-Seed 'The API returned no list response; no write was attempted.' }
    $properties = @($Response.PSObject.Properties.Name)
    if ($Response -is [array]) { return @($Response) }
    if ($properties -contains 'items') { return @($Response.items) }
    if ($properties -contains 'data' -and $Response.data -is [array]) { return @($Response.data) }
    if ($Response -is [System.Collections.IEnumerable] -and $Response -isnot [string]) { return @($Response) }
    Stop-Seed 'Unexpected list response shape; no write attempted.'
}
function One-By([object[]]$Rows, [scriptblock]$Predicate, [string]$Label) {
    $matches = @($Rows | Where-Object $Predicate)
    if ($matches.Count -gt 1) { Stop-Seed "Multiple $Label matches; refusing to choose." }
    if ($matches.Count -eq 1) { return $matches[0] }
    return $null
}
function Assert-ReceiptIdentity($Record, $Expected, [string]$Label) {
    Require-Field $Record id $Label; Require-Field $Record status $Label
    if ($Record.status -eq 'VOIDED') { Stop-Seed "$Label is VOIDED; refusing to replay it." }
    if ($Record.status -notin @('DRAFT', 'POSTED')) { Stop-Seed "$Label has unsupported status '$($Record.status)'." }
    Assert-TextEqual $Record.invoiceNumber $Expected.invoiceNumber "$Label invoiceNumber"
    if ([long]$Record.supplierId -ne [long]$Expected.supplierId) { Stop-Seed "$Label supplierId does not match." }
    Assert-TextEqual ([string]$Record.receiptDate) ([string]$Expected.receiptDate) "$Label receiptDate"
    if ([long]$Record.transportFee -ne [long]$Expected.transportFee) { Stop-Seed "$Label transportFee does not match." }
    Require-Field $Record lines $Label
    $actualLines = @($Record.lines); $expectedLines = @($Expected.lines)
    if ($actualLines.Count -ne $expectedLines.Count) { Stop-Seed "$Label lines do not match exactly." }
    for ($i = 0; $i -lt $expectedLines.Count; $i++) {
        $actual = $actualLines[$i]; $expected = $expectedLines[$i]
        if ([long]$actual.feedItemId -ne [long]$expected.feedItemId) { Stop-Seed "$Label line[$i] feedItemId does not match." }
        Assert-DecimalEqual $actual.quantityPurchase $expected.quantityPurchase "$Label line[$i] quantityPurchase"
        Assert-TextEqual $actual.purchaseUnit $expected.purchaseUnit "$Label line[$i] purchaseUnit"
        if ([long]$actual.unitPrice -ne [long]$expected.unitPrice) { Stop-Seed "$Label line[$i] unitPrice does not match." }
    }
}
function Assert-RationIdentity($Record, $Expected, [string]$Label) {
    Require-Field $Record id $Label; Require-Field $Record status $Label
    if ($Record.status -notin @('EFFECTIVE', 'SCHEDULED', 'ENDED')) { Stop-Seed "$Label has unsupported status '$($Record.status)'; refusing to replay it." }
    Assert-TextEqual $Record.rationCode $Expected.rationCode "$Label rationCode"
    Assert-TextEqual $Record.name $Expected.name "$Label name"
    Assert-TextEqual $Record.herdGroup $Expected.herdGroup "$Label herdGroup"
    Assert-TextEqual $Record.basis $Expected.basis "$Label basis"
    Assert-TextEqual ([string]$Record.effectiveFrom) ([string]$Expected.effectiveFrom) "$Label effectiveFrom"
    if ([int]$Record.sessionsPerDay -ne [int]$Expected.sessionsPerDay) { Stop-Seed "$Label sessionsPerDay does not match." }
    Assert-TextListEqual @($Record.sessionTimes) @($Expected.sessionTimes) "$Label sessionTimes"
    Assert-IdListEqual @($Record.penIds) @($Expected.penIds) "$Label penIds"
    Require-Field $Record components $Label
    $actualLines = @($Record.components); $expectedLines = @($Expected.components)
    if ($actualLines.Count -ne $expectedLines.Count) { Stop-Seed "$Label component lines do not match exactly." }
    for ($i = 0; $i -lt $expectedLines.Count; $i++) {
        $actual = $actualLines[$i]; $expected = $expectedLines[$i]
        if ([long]$actual.feedItemId -ne [long]$expected.feedItemId) { Stop-Seed "$Label line[$i] feedItemId does not match." }
        Assert-DecimalEqual $actual.session1Kg $expected.session1Kg "$Label line[$i] session1Kg"
        Assert-DecimalEqual $actual.session2Kg $expected.session2Kg "$Label line[$i] session2Kg"
        Assert-DecimalEqual $actual.session3Kg $expected.session3Kg "$Label line[$i] session3Kg"
    }
}
function Assert-RationEffectiveForDate($Record, [datetime]$Date, [string]$Label) {
    Require-Field $Record status $Label; Require-Field $Record effectiveFrom $Label
    if (@($Record.PSObject.Properties.Name) -notcontains 'effectiveTo') { Stop-Seed "$Label response is missing 'effectiveTo'." }
    if ($Record.status -eq 'CANCELLED') { Stop-Seed "$Label is CANCELLED; it cannot supply feeding on $($Date.ToString('yyyy-MM-dd'))." }
    $effectiveFrom = try { ([datetime]::Parse([string]$Record.effectiveFrom)).Date } catch { Stop-Seed "$Label effectiveFrom is not a valid date." }
    $effectiveTo = $null
    if (-not [string]::IsNullOrWhiteSpace([string]$Record.effectiveTo)) {
        $effectiveTo = try { ([datetime]::Parse([string]$Record.effectiveTo)).Date } catch { Stop-Seed "$Label effectiveTo is not a valid date." }
    }
    $today = (Get-Date).Date
    $expectedStatus = if ($effectiveFrom -gt $today) { 'SCHEDULED' } elseif ($null -ne $effectiveTo -and $effectiveTo -lt $today) { 'ENDED' } else { 'EFFECTIVE' }
    if ([string]$Record.status -cne $expectedStatus) { Stop-Seed "$Label status '$($Record.status)' does not match its effective date range (expected $expectedStatus)." }
    if ($effectiveFrom -gt $Date.Date) { Stop-Seed "$Label starts on $($effectiveFrom.ToString('yyyy-MM-dd')), after feeding date $($Date.ToString('yyyy-MM-dd')); refusing a future ration." }
    if ($null -ne $effectiveTo -and $effectiveTo -lt $Date.Date) { Stop-Seed "$Label ended on $($effectiveTo.ToString('yyyy-MM-dd')), before feeding date $($Date.ToString('yyyy-MM-dd')); no effective ration exists for that feeding." }
}
function Assert-FeedingIdentity($Record, $Expected, [string]$Label) {
    Require-Field $Record id $Label; Require-Field $Record status $Label
    if ($Record.status -eq 'VOIDED') { Stop-Seed "$Label is VOIDED; refusing to replay it." }
    if ($Record.status -ne 'VALID') { Stop-Seed "$Label has unsupported status '$($Record.status)'." }
    if ([long]$Record.penId -ne [long]$Expected.penId) { Stop-Seed "$Label penId does not match." }
    Assert-TextEqual ([string]$Record.feedingDate) ([string]$Expected.feedingDate) "$Label feedingDate"
    if ([int]$Record.sessionNo -ne [int]$Expected.sessionNo) { Stop-Seed "$Label sessionNo does not match." }
    Require-Field $Record lines $Label
    $actualLines = @($Record.lines); $expectedLines = @($Expected.lines)
    if ($actualLines.Count -ne $expectedLines.Count) { Stop-Seed "$Label lines do not match exactly." }
    for ($i = 0; $i -lt $expectedLines.Count; $i++) {
        $actual = $actualLines[$i]; $expected = $expectedLines[$i]
        if ([long]$actual.feedItemId -ne [long]$expected.feedItemId) { Stop-Seed "$Label line[$i] feedItemId does not match." }
        Assert-DecimalEqual $actual.actualKg $expected.actualKg "$Label line[$i] actualKg"
    }
}

$root = try { [uri]$BaseUrl } catch { Stop-Seed "BaseUrl '$BaseUrl' is invalid." }
if ($BaseUrl.Contains('?') -or $BaseUrl.Contains('#')) { Stop-Seed 'BaseUrl must not contain a query or fragment.' }
Assert-LocalUrl $root
Assert-PositiveId $FarmId 'FarmId'; Assert-PositiveId $SupplierId 'SupplierId'; Assert-PositiveId $FeedItemId 'FeedItemId'; Assert-PositiveId $PenId 'PenId'
if ($SeedIdentity -notmatch '^beefcare-local-demo-[a-z0-9-]+$') { Stop-Seed 'SeedIdentity must be a stable beefcare-local-demo-* value.' }
if ($SessionNo -lt 1 -or $SessionNo -gt 3) { Stop-Seed 'SessionNo must be 1, 2, or 3.' }
if ([string]::IsNullOrWhiteSpace($ReceiptDate) -or [string]::IsNullOrWhiteSpace($FeedingDate)) { Stop-Seed 'ReceiptDate and FeedingDate are required inputs; no dates are invented.' }
if ([string]::IsNullOrWhiteSpace($RationName)) { Stop-Seed 'RationName is required; no domain name is invented.' }
$receiptDateValue = try { ([datetime]::Parse($ReceiptDate)).Date } catch { Stop-Seed 'ReceiptDate is not a valid ISO/local date.' }
$feedingDateValue = try { ([datetime]::Parse($FeedingDate)).Date } catch { Stop-Seed 'FeedingDate is not a valid ISO/local date.' }
if ($receiptDateValue -gt (Get-Date).Date) { Stop-Seed 'ReceiptDate cannot be in the future; the API rejects future receipts.' }
if ($feedingDateValue -gt (Get-Date).Date) { Stop-Seed 'FeedingDate cannot be in the future; the API rejects future feeding records.' }
if ($receiptDateValue -gt $feedingDateValue) { Stop-Seed 'ReceiptDate is after FeedingDate; a ration effective from this receipt date would be future-dated for the requested feeding.' }
if ($QuantityPurchase -le 0 -or $UnitPrice -le 0 -or $Session1Kg -le 0 -or $ActualKg -le 0) { Stop-Seed 'QuantityPurchase, UnitPrice, Session1Kg, and ActualKg are required positive inputs.' }
if ([string]::IsNullOrWhiteSpace($PurchaseUnit) -or [string]::IsNullOrWhiteSpace($SessionTime)) { Stop-Seed 'PurchaseUnit and SessionTime are required inputs; no units/times are invented.' }
if ($SessionTime -notmatch '^(?:[01]\d|2[0-3]):[0-5]\d$') { Stop-Seed 'SessionTime must use HH:mm.' }

$receiptKey = "${SeedIdentity}:receipt"; $postReceiptKey = "${SeedIdentity}:receipt-post"; $rationKey = "${SeedIdentity}:ration"; $feedingKey = "${SeedIdentity}:feeding"
$from = $feedingDateValue.ToString('yyyy-MM-dd'); $to = $from; $receiptDateText = $receiptDateValue.ToString('yyyy-MM-dd')
$expectedReceipt = [ordered]@{ receiptDate = $receiptDateText; supplierId = $SupplierId; invoiceNumber = $InvoiceNumber; transportFee = 0; lines = @(@{ feedItemId = $FeedItemId; quantityPurchase = $QuantityPurchase; purchaseUnit = $PurchaseUnit; unitPrice = $UnitPrice }); postNow = $false }
$expectedRation = [ordered]@{ rationCode = $RationCode; name = $RationName; herdGroup = $null; basis = $null; effectiveFrom = $receiptDateText; sessionsPerDay = 1; sessionTimes = @($SessionTime); penIds = @($PenId); components = @(@{ feedItemId = $FeedItemId; session1Kg = $Session1Kg; session2Kg = 0; session3Kg = 0 }) }
$expectedFeeding = [ordered]@{ penId = $PenId; feedingDate = $from; sessionNo = $SessionNo; lines = @(@{ feedItemId = $FeedItemId; actualKg = $ActualKg }) }

Write-Host "Local-only first slice (dry-run unless -Apply): $SeedIdentity"
Write-Host "  routes: /api/farms/$FarmId/feed/{receipts,rations,feeding-records}"
Write-Host "  identity: invoice=$InvoiceNumber rationCode=$RationCode pen=$PenId date=$from session=$SessionNo"
Write-Host "  data: one supplier=$SupplierId, feedItem=$FeedItemId, receipt=$QuantityPurchase $PurchaseUnit @ $UnitPrice, ration=$Session1Kg kg/session, actual=$ActualKg kg"
if (-not $Apply) { Write-Host 'No reads or writes performed. Use -Apply only after reviewing the local IDs and session artifacts.'; return }
if ([string]::IsNullOrWhiteSpace($CookieHeader) -or [string]::IsNullOrWhiteSpace($CsrfHeaderName) -or [string]::IsNullOrWhiteSpace($CsrfToken)) { Stop-Seed 'Missing session contract: export CookieHeader, CsrfHeaderName, and CsrfToken from scripts/seed-qa-fixtures.py. No POST was attempted.' }

$commonHeaders = @{ Accept = 'application/json'; Cookie = $CookieHeader }
function Invoke-Api {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([ValidateSet('GET', 'POST')][string]$Method, [uri]$Uri, [object]$Body = $null, [string]$IdempotencyKey = $null)
    $headers = @{} + $commonHeaders
    if ($Method -eq 'POST') {
        if (-not $PSCmdlet.ShouldProcess($Uri.AbsoluteUri, 'POST')) { return [pscustomobject]@{ __skippedByWhatIf = $true } }
        if ([string]::IsNullOrWhiteSpace($IdempotencyKey)) { Stop-Seed "POST $Uri is missing an Idempotency-Key." }
        $headers[$CsrfHeaderName] = $CsrfToken; $headers['Idempotency-Key'] = $IdempotencyKey
    }
    $params = @{ Method = $Method; Uri = $Uri.AbsoluteUri; Headers = $headers; ErrorAction = 'Stop' }
    if ($null -ne $Body) { $params.ContentType = 'application/json'; $params.Body = ($Body | ConvertTo-Json -Depth 20) }
    try { return Invoke-RestMethod @params } catch { Stop-Seed "$Method $Uri failed: $($_.Exception.Message)" }
}

# All explicit IDs are checked before the first possible write. Ration is
# intentionally read-only here: this API requires new rations to start tomorrow,
# while feeding records reject future dates, so a missing ration needs an approved
# pre-create step rather than a partial receipt/feeding seed.
$supplierRows = Items (Invoke-Api GET (Api-Uri "/api/farms/$FarmId/trading-partners?role=SUPPLIER&status=ACTIVE"))
$supplier = One-By $supplierRows { [long]$_.id -eq $SupplierId } 'supplier'
if ($null -eq $supplier -or $supplier.supplier -ne $true) { Stop-Seed "SupplierId $SupplierId is not an active supplier in farm $FarmId." }
$catalogue = Items (Invoke-Api GET (Api-Uri "/api/farms/$FarmId/feed/catalogue"))
$feed = One-By $catalogue { [long]$_.id -eq $FeedItemId } 'feed item'
if ($null -eq $feed) { Stop-Seed "FeedItemId $FeedItemId is not present in the farm catalogue." }
if ($feed.available -ne $true) { Stop-Seed "FeedItemId $FeedItemId is not available in the farm catalogue." }
$pen = Invoke-Api GET (Api-Uri "/api/farms/$FarmId/pens/$PenId")
Require-Field $pen id 'Pen'; Require-Field $pen status 'Pen'
if ([long]$pen.id -ne $PenId -or $pen.status -ne 'ACTIVE') { Stop-Seed "PenId $PenId is not an ACTIVE pen in farm $FarmId." }
$stockBeforeRows = Items (Invoke-Api GET (Api-Uri "/api/farms/$FarmId/feed/stock"))
$stockBefore = One-By $stockBeforeRows { [long]$_.feedItemId -eq $FeedItemId } 'stock item'
if ($null -eq $stockBefore) { Stop-Seed "FeedItemId $FeedItemId has no stock view; refusing to infer a stock baseline." }
$receiptRows = Items (Invoke-Api GET (Api-Uri "/api/farms/$FarmId/feed/receipts")); $rationRows = Items (Invoke-Api GET (Api-Uri "/api/farms/$FarmId/feed/rations")); $feedingRows = Items (Invoke-Api GET (Api-Uri "/api/farms/$FarmId/feed/feeding-records?from=$from&to=$to"))
$receipt = One-By $receiptRows { $_.invoiceNumber -eq $InvoiceNumber } 'receipt invoice'; $ration = One-By $rationRows { $_.rationCode -eq $RationCode } 'ration code'; $feeding = One-By $feedingRows { [long]$_.penId -eq $PenId -and $_.feedingDate -eq $from -and [int]$_.sessionNo -eq $SessionNo } 'feeding record'
if ($null -ne $receipt) { Assert-ReceiptIdentity $receipt $expectedReceipt 'Existing receipt' }
if ($null -ne $ration) {
    Assert-RationIdentity $ration $expectedRation 'Existing ration'
    Assert-RationEffectiveForDate $ration $feedingDateValue 'Existing ration'
}
if ($null -ne $feeding) { Assert-FeedingIdentity $feeding $expectedFeeding 'Existing feeding record' }
if ($null -eq $ration) {
    Stop-Seed 'Ration preflight failed: no existing ration with the requested rationCode is available for this pen and feeding date. This API requires new rations to start tomorrow while feeding rejects future dates, so pre-create a compatible effective ration before applying this helper; no POST was attempted.'
}

$receiptPostedThisRun = $false
if ($null -eq $receipt) { $receipt = Invoke-Api POST (Api-Uri "/api/farms/$FarmId/feed/receipts") $expectedReceipt $receiptKey; Assert-WriteResult $receipt 'Receipt creation'; Assert-ReceiptIdentity $receipt $expectedReceipt 'Created receipt'; Write-Host "Created receipt draft id=$($receipt.id)" } else { Write-Host "Reusing receipt id=$($receipt.id) status=$($receipt.status)" }
if ($receipt.status -eq 'DRAFT') { Require-Field $receipt version 'Receipt draft'; $receipt = Invoke-Api POST (Api-Uri "/api/farms/$FarmId/feed/receipts/$($receipt.id)/post") @{ expectedVersion = [int]$receipt.version } $postReceiptKey; Assert-WriteResult $receipt 'Receipt posting'; Assert-ReceiptIdentity $receipt $expectedReceipt 'Posted receipt'; $receiptPostedThisRun = $true; Write-Host "Posted receipt id=$($receipt.id)" }
if ($receipt.status -ne 'POSTED') { Stop-Seed "Receipt $($receipt.id) is not POSTED after post/readback." }
$receiptReadback = Invoke-Api GET (Api-Uri "/api/farms/$FarmId/feed/receipts/$($receipt.id)"); Assert-ReceiptIdentity $receiptReadback $expectedReceipt 'Receipt readback'; if ($receiptReadback.status -ne 'POSTED') { Stop-Seed 'Receipt detail readback did not prove the posted receipt.' }
$stockAfterRows = Items (Invoke-Api GET (Api-Uri "/api/farms/$FarmId/feed/stock")); $stockAfter = One-By $stockAfterRows { [long]$_.feedItemId -eq $FeedItemId } 'stock item after receipt'; if ($null -eq $stockAfter) { Stop-Seed 'Stock readback did not contain the requested feed item.' }; if ([decimal]$stockAfter.onHandKg -lt [decimal]$stockBefore.onHandKg) { Stop-Seed 'Stock onHandKg decreased unexpectedly.' }; if ($receiptPostedThisRun -and [decimal]$stockAfter.onHandKg -le [decimal]$stockBefore.onHandKg) { Stop-Seed 'Posted receipt did not increase onHandKg in stock readback.' }
$rationReadbackRows = Items (Invoke-Api GET (Api-Uri "/api/farms/$FarmId/feed/rations")); $rationReadback = One-By $rationReadbackRows { [long]$_.id -eq [long]$ration.id } 'ration readback'; if ($null -eq $rationReadback) { Stop-Seed 'Ration readback did not contain the existing ration.' }; Assert-RationIdentity $rationReadback $expectedRation 'Ration readback'; Assert-RationEffectiveForDate $rationReadback $feedingDateValue 'Ration readback'; $ration = $rationReadback
if ($null -eq $feeding) { $feeding = Invoke-Api POST (Api-Uri "/api/farms/$FarmId/feed/feeding-records") $expectedFeeding $feedingKey; Assert-WriteResult $feeding 'Feeding record creation'; Assert-FeedingIdentity $feeding $expectedFeeding 'Created feeding record'; Write-Host "Created feeding record id=$($feeding.id)" } else { Write-Host "Reusing feeding record id=$($feeding.id)" }
$feedingReadbackRows = Items (Invoke-Api GET (Api-Uri "/api/farms/$FarmId/feed/feeding-records?from=$from&to=$to")); $feedingReadback = One-By $feedingReadbackRows { [long]$_.id -eq [long]$feeding.id } 'feeding readback'; if ($null -eq $feedingReadback) { Stop-Seed 'Feeding readback did not contain the created/reused record.' }; Assert-FeedingIdentity $feedingReadback $expectedFeeding 'Feeding readback'
$reminders = Items (Invoke-Api GET (Api-Uri "/api/farms/$FarmId/feed/reminders")); Write-Host "Readback OK: receipt=$($receipt.id) status=$($receipt.status); ration=$($ration.id); feeding=$($feeding.id); stockOnHandKg=$($stockAfter.onHandKg)"; Write-Host "Reminder readback rows=$($reminders.Count) (codes are reported from API; no REM-10/11 is hard-coded)."; Write-Host 'Replay with the same identity reuses receipt, ration, and pen/date/session feeding without duplicates.'
