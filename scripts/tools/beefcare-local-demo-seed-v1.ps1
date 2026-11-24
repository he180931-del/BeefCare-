[CmdletBinding()]
param(
    [switch]$Apply,
    [string]$BaseUrl = $(if ($env:BEEFCARE_LOCAL_API_BASE_URL) { $env:BEEFCARE_LOCAL_API_BASE_URL } else { 'http://127.0.0.1:8080' }),
    [long]$FarmId = $(if ($env:BEEFCARE_LOCAL_FARM_ID) { [long]$env:BEEFCARE_LOCAL_FARM_ID } else { 0 }),
    [string]$FarmName = $(if ($env:BEEFCARE_LOCAL_FARM_NAME) { $env:BEEFCARE_LOCAL_FARM_NAME } else { 'BeefCare Local Farm A' }),
    [string]$Username = $(if ($env:BEEFCARE_LOCAL_SEED_USERNAME) { $env:BEEFCARE_LOCAL_SEED_USERNAME } else { 'owner@beefcare.local' }),
    [string]$SeedPrefix = $(if ($env:BEEFCARE_LOCAL_SEED_PREFIX) { $env:BEEFCARE_LOCAL_SEED_PREFIX } else { 'beefcare-local-demo-v1' })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:root = $null
$script:webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$script:csrfToken = $null
$script:blockers = New-Object System.Collections.Generic.List[string]
$script:readbacks = [ordered]@{}

function Stop-Seed([string]$Message) { throw "[beefcare-local-demo-seed-v1] $Message" }

function Add-Blocker([string]$Scenario, [string]$Path, [int]$Status, [string]$Reason) {
    $line = "$Scenario blocked: $Path returned HTTP $Status ($Reason)."
    if (-not $script:blockers.Contains($line)) { [void]$script:blockers.Add($line) }
    Write-Warning $line
}

function Assert-LocalUrl([uri]$Uri) {
    if ($null -eq $Uri -or -not $Uri.IsAbsoluteUri -or $Uri.Scheme -cne 'http' -or
        @('localhost', '127.0.0.1', '::1') -notcontains $Uri.IdnHost.ToLowerInvariant() -or
        $Uri.AbsolutePath -ne '/' -or $Uri.Query -or $Uri.Fragment -or $Uri.UserInfo) {
        Stop-Seed "Refusing BaseUrl '$Uri'. Use an http loopback backend URL with no path, query, fragment, or credentials."
    }
}

function Api-Uri([string]$Path) {
    return [uri](($script:root.AbsoluteUri.TrimEnd('/')) + '/' + $Path.TrimStart('/'))
}

function Invoke-Api {
    param(
        [ValidateSet('GET', 'POST', 'PUT', 'PATCH', 'DELETE')][string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$IdempotencyKey = $null,
        [switch]$AllowFailure
    )
    $headers = @{ Accept = 'application/json' }
    if ($script:csrfToken) { $headers['X-XSRF-TOKEN'] = $script:csrfToken }
    if ($Method -in @('POST', 'PUT', 'PATCH', 'DELETE') -and $IdempotencyKey) {
        $headers['Idempotency-Key'] = $IdempotencyKey
    }
    $args = @{ Method = $Method; Uri = (Api-Uri $Path).AbsoluteUri; WebSession = $script:webSession; Headers = $headers; ErrorAction = 'Stop' }
    if ($null -ne $Body) {
        $args.ContentType = 'application/json'
        $args.Body = ($Body | ConvertTo-Json -Depth 30 -Compress)
    }
    try {
        return Invoke-RestMethod @args
    } catch {
        $response = if (@($_.Exception.PSObject.Properties.Name) -contains 'Response') { $_.Exception.Response } else { $null }
        $status = if ($response) { [int]$response.StatusCode } else { 0 }
        if ($AllowFailure) {
            return [pscustomobject]@{ __apiFailure = $true; path = $Path; status = $status }
        }
        Stop-Seed "$Method $Path failed with HTTP $status."
    }
}

function Is-ApiFailure($Value) { return $null -ne $Value -and @($Value.PSObject.Properties.Name) -contains '__apiFailure' -and $Value.__apiFailure }

function Get-OptionalProperty($Object, [string]$Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Get-Items($Response, [string]$Label) {
    if ($null -eq $Response -or (Is-ApiFailure $Response)) { Stop-Seed "$Label returned no usable list." }
    if ($Response -is [array]) { return @($Response) }
    $properties = @($Response.PSObject.Properties.Name)
    if ($properties -contains 'items') { return @($Response.items) }
    if ($properties -contains 'data' -and $Response.data -is [array]) { return @($Response.data) }
    if ($properties -contains 'pens') { return @($Response.pens) }
    Stop-Seed "$Label returned an unsupported response shape."
}

function Find-One([object[]]$Rows, [scriptblock]$Predicate, [string]$Label) {
    $matches = @($Rows | Where-Object $Predicate)
    if ($matches.Count -gt 1) { Stop-Seed "More than one $Label matched the deterministic sentinel; refusing to choose." }
    if ($matches.Count -eq 1) { return $matches[0] }
    return $null
}

function Find-Any([object[]]$Rows, [scriptblock]$Predicate) {
    return @($Rows | Where-Object $Predicate | Select-Object -First 1)[0]
}

function Read-Password {
    $fromEnv = $env:BEEFCARE_DEV_PASSWORD
    if (-not [string]::IsNullOrWhiteSpace($fromEnv)) { return $fromEnv }
    $secure = Read-Host 'BEEFCARE_DEV_PASSWORD (hidden)' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Authenticate([string]$Password) {
    $csrf = Invoke-Api GET '/api/csrf'
    if (-not $csrf.token) { Stop-Seed 'GET /api/csrf did not return a token.' }
    $script:csrfToken = [string]$csrf.token
    Invoke-Api POST '/api/authenticate' @{ username = $Username; password = $Password; rememberMe = $false } | Out-Null
    $csrfAfterLogin = Invoke-Api GET '/api/csrf'
    if (-not $csrfAfterLogin.token) { Stop-Seed 'Authenticated session could not refresh CSRF.' }
    $script:csrfToken = [string]$csrfAfterLogin.token
}

function Create-Or-ReadFeedItem([object[]]$Catalogue, [string]$Code, [string]$Name, [decimal]$MinimumKg, [string]$Key) {
    $item = Find-One $Catalogue { $_.code -eq $Code } "feed item $Code"
    if ($null -eq $item) {
        if (-not $Apply) { return [pscustomobject]@{ id = $null; code = $Code; name = $Name; minimumStockKg = $MinimumKg; available = $true; __planned = $true } }
        $item = Invoke-Api POST "/api/farms/$farmId/feed/catalogue" @{ code = $Code; name = $Name; feedGroup = 'DRY_ROUGHAGE'; purchaseUnit = 'kg'; kgPerPurchaseUnit = 1; minimumStockKg = $MinimumKg; nutritionNote = "$SeedPrefix sentinel"; available = $true } $Key
    }
    if ([string]$item.name -ne $Name -or -not $item.available -or [decimal]$item.minimumStockKg -ne $MinimumKg) { Stop-Seed "Feed item $Code already exists with different data or is unavailable." }
    return $item
}

function Assert-Field($Object, [string]$Name, [string]$Label) {
    if ($null -eq $Object -or @($Object.PSObject.Properties.Name) -notcontains $Name) { Stop-Seed "$Label is missing '$Name'." }
}

function Get-ScenarioAnnouncement([object[]]$Rows) {
    $matches = @()
    foreach ($row in $Rows) {
        $versions = @(Get-OptionalProperty $row 'versions')
        $versionMatch = Find-Any $versions { $_.title -like "$SeedPrefix FE-07*" }
        if ($row.draftTitle -eq "$SeedPrefix FE-07 announcement" -or $row.title -eq "$SeedPrefix FE-07 announcement" -or
            $row.title -eq "$SeedPrefix FE-07 correction" -or $null -ne $versionMatch) { $matches += $row }
    }
    if ($matches.Count -gt 1) { Stop-Seed 'More than one FE-07 sentinel announcement exists; refusing to choose.' }
    if ($matches.Count -eq 1) { return $matches[0] }
    return $null
}

$script:root = try { [uri]$BaseUrl } catch { Stop-Seed "BaseUrl '$BaseUrl' is invalid." }
Assert-LocalUrl $script:root
if ($SeedPrefix -notmatch '^beefcare-local-demo-v1$') { Stop-Seed 'SeedPrefix is versioned and must remain beefcare-local-demo-v1.' }

$password = Read-Password
try {
    Write-Host "BeefCare local demo seed v1 (dry-run by default)"
    Write-Host "  Base URL: $BaseUrl"
    Write-Host "  Account: $Username (password is never printed)"
    Authenticate $password
} finally {
    $password = $null
}

$health = Invoke-Api GET '/management/health' -AllowFailure
if (Is-ApiFailure $health) { Stop-Seed 'GET /management/health did not return a healthy local backend.' }

$farmRows = Get-Items (Invoke-Api GET '/api/farms') 'farm list'
$farm = if ($FarmId -gt 0) { Find-One $farmRows { [long]$_.id -eq $FarmId } "farm id $FarmId" } else { Find-One $farmRows { $_.name -eq $FarmName -and $_.role -eq 'OWNER' } "owner farm '$FarmName'" }
if ($null -eq $farm) { Stop-Seed 'The requested farm was not found for the authenticated owner.' }
$farmId = [long]$farm.id
Write-Host "  Farm: $($farm.name) (discovered id=$farmId; role=$($farm.role))"

$members = Get-Items (Invoke-Api GET "/api/farms/$farmId/announcements/recipients") 'announcement recipients'
$technicians = @($members | Where-Object { $_.active -eq $true -and $_.role -eq 'TECHNICIAN' })
$existingAnnouncements = Get-Items (Invoke-Api GET "/api/farms/$farmId/announcements") 'announcement list'
$existingAnnouncement = Get-ScenarioAnnouncement $existingAnnouncements
if ($technicians.Count -eq 0 -and $Apply -and $null -eq $existingAnnouncement) { Add-Blocker 'FE-07 recipient delivery' "/api/farms/$farmId/announcements/recipients" 200 'no active technician membership was available' }

$catalogue = Get-Items (Invoke-Api GET "/api/farms/$farmId/feed/catalogue") 'feed catalogue'
$stockItem = Create-Or-ReadFeedItem $catalogue 'TA-98' "$SeedPrefix stocked feed" 50 "$SeedPrefix:feed-item-stocked"
$emptyItem = Create-Or-ReadFeedItem $catalogue 'TA-99' "$SeedPrefix out-of-stock feed" 10 "$SeedPrefix:feed-item-empty"
$stockItemId = if ($stockItem.id) { [long]$stockItem.id } else { 0 }
$emptyItemId = if ($emptyItem.id) { [long]$emptyItem.id } else { 0 }

$partners = Get-Items (Invoke-Api GET "/api/farms/$farmId/trading-partners") 'supplier list'
$supplier = Find-One $partners { $_.name -eq "$SeedPrefix supplier" -and $_.supplier -eq $true } 'FE-23 supplier'
if ($null -eq $supplier -and $Apply) {
    $supplier = Invoke-Api POST "/api/farms/$farmId/trading-partners" @{ name = "$SeedPrefix supplier"; seller = $false; buyer = $false; supplier = $true; phone = '0900000098'; area = 'Local demo'; note = "$SeedPrefix sentinel" } "$SeedPrefix:supplier"
}
if ($null -ne $supplier -and $supplier.status -ne 'ACTIVE' -and $Apply) {
    $supplier = Invoke-Api PATCH "/api/farms/$farmId/trading-partners/$($supplier.id)/status" @{ status = 'ACTIVE'; expectedVersion = [int]$supplier.version } "$SeedPrefix:supplier-active"
}
if ($null -eq $supplier -and $Apply) { Add-Blocker 'FE-23 posted receipt' "/api/farms/$farmId/trading-partners" 200 'supplier is absent and could not be created' }

$penRows = Get-Items (Invoke-Api GET "/api/farms/$farmId/pens?status=ACTIVE") 'active pen list'
$pen = Find-One $penRows { $_.status -eq 'ACTIVE' } 'active pen'
if ($Apply -and $null -eq $pen) { Add-Blocker 'FE-23 future ration' "/api/farms/$farmId/pens?status=ACTIVE" 200 'no active pen is available' }
$penId = if ($pen) { [long]$pen.id } else { 0 }

$today = (Get-Date).Date
$receiptDate = $today.ToString('yyyy-MM-dd')
$receiptRows = Get-Items (Invoke-Api GET "/api/farms/$farmId/feed/receipts") 'receipt list'
$receipt = Find-One $receiptRows { $_.invoiceNumber -eq "$SeedPrefix posted receipt" } 'FE-23 posted receipt'
$receiptBody = @{ receiptDate = $receiptDate; supplierId = if ($supplier) { [long]$supplier.id } else { 0 }; invoiceNumber = "$SeedPrefix posted receipt"; receivedBy = 'Local demo'; storageLocation = 'Demo store'; note = "$SeedPrefix posted stock"; transportFee = 0; amountPaid = 0; lines = @(@{ feedItemId = $stockItemId; lotNumber = "$SeedPrefix-lot"; expiryDate = $today.AddMonths(6).ToString('yyyy-MM-dd'); quantityPurchase = 100; purchaseUnit = 'kg'; unitPrice = 1000 }); postNow = $true }

$rationRows = Get-Items (Invoke-Api GET "/api/farms/$farmId/feed/rations") 'ration list'
$ration = Find-One $rationRows { $_.rationCode -eq "$SeedPrefix ration" } 'FE-23 future ration'
$rationEffectiveFrom = if ($ration) { [string]$ration.effectiveFrom } else { '2030-01-01' }
$rationBody = @{ rationCode = "$SeedPrefix ration"; name = "$SeedPrefix future ration"; herdGroup = 'FATTENING'; basis = 'Local demo source data'; effectiveFrom = $rationEffectiveFrom; sessionsPerDay = 1; sessionTimes = @('06:30'); penIds = @($penId); components = @(@{ feedItemId = $stockItemId; session1Kg = 1.0; session2Kg = 0; session3Kg = 0 }) }
if ($null -ne $receipt -and ($receipt.status -eq 'VOIDED' -or @($receipt.lines).Count -ne 1 -or [long]$receipt.lines[0].feedItemId -ne $stockItemId)) { Stop-Seed 'The deterministic receipt invoice already exists with incompatible data.' }
if ($null -ne $ration -and ([string]$ration.name -ne "$SeedPrefix future ration" -or @($ration.penIds | Where-Object { [long]$_ -eq $penId }).Count -ne 1 -or @($ration.components | Where-Object { [long]$_.feedItemId -eq $stockItemId }).Count -ne 1)) { Stop-Seed 'The deterministic ration code already exists with incompatible data.' }
if ($null -ne $ration -and $ration.status -eq 'CANCELLED') { Stop-Seed 'The deterministic ration code already exists but its future version is cancelled.' }

$cattlePage = Invoke-Api GET "/api/farms/$farmId/cattle?sex=FEMALE&herdStatus=ACTIVE&page=0&size=100" -AllowFailure
$cattlePageFailed = Is-ApiFailure $cattlePage
$cattleRows = if ($cattlePageFailed) { @() } else { Get-Items $cattlePage 'female cattle list' }
$female = Find-One $cattleRows { $_.breedingEligible -eq $true } 'breeding-eligible female cattle'
$reminderRowsBeforeResponse = Invoke-Api GET "/api/farms/$farmId/reminders" -AllowFailure
$reminderRowsBefore = if (Is-ApiFailure $reminderRowsBeforeResponse) { @() } else { Get-Items $reminderRowsBeforeResponse 'farm reminder list' }
$reminderRowsBeforeFailed = Is-ApiFailure $reminderRowsBeforeResponse
if ($Apply -and $reminderRowsBeforeFailed) { Add-Blocker 'FE-14 normal reminder' "/api/farms/$farmId/reminders" $reminderRowsBeforeResponse.status 'farm reminder route was unavailable during preflight' }
$normalReminderBefore = Find-Any $reminderRowsBefore { $_.ruleType -ne 'REM-10' -and $_.ruleType -ne 'REM-11' }
$event = $null
$historyFailed = $false
if ($female) {
    $history = Invoke-Api GET "/api/farms/$farmId/cattle/$($female.id)/reproduction-history?type=ESTRUS" -AllowFailure
    $historyFailed = Is-ApiFailure $history
    if (-not $historyFailed) {
        $timeline = @($history.timeline)
        $event = Find-One $timeline { $_.kind -eq 'ESTRUS' -and $_.description -eq "$SeedPrefix breeding-window" } 'FE-14 reproduction event'
    }
}
if ($Apply -and $cattlePageFailed) {
    Add-Blocker 'FE-14 normal reminder' "/api/farms/$farmId/cattle?sex=FEMALE&herdStatus=ACTIVE&page=0&size=100" $cattlePage.status 'female cattle source route was unavailable'
}
if ($Apply -and $historyFailed) {
    Add-Blocker 'FE-14 breeding-window source' "/api/farms/$farmId/cattle/$($female.id)/reproduction-history?type=ESTRUS" $history.status 'reproduction history route was unavailable; no estrus POST was attempted without an idempotent readback'
}
if ($Apply -and $null -eq $event -and $null -eq $female -and -not $cattlePageFailed) {
    Add-Blocker 'FE-14 normal reminder' "/api/farms/$farmId/cattle?sex=FEMALE&herdStatus=ACTIVE&page=0&size=100" 200 'no breeding-eligible female cattle exists for the supported estrus command'
}

if (-not $Apply) {
    Write-Host 'Dry-run: no scenario write was performed (the authentication POST is required for read access).'
    Write-Host "  Planned FE-07: announcement '$SeedPrefix FE-07 announcement' -> publish -> correction; recipients=$($technicians.Count)"
    Write-Host "  Planned FE-23: supplier='$SeedPrefix supplier', receipt='$SeedPrefix posted receipt', feed=TA-98/TA-99, ration='$SeedPrefix ration' effective=$rationEffectiveFrom"
    Write-Host "  FE-14 existing normal reminder: $([bool]($null -ne $normalReminderBefore)); breeding event present: $([bool]($null -ne $event))"
} else {
    $feedScenarioReady = $true
    if ($null -eq $supplier) { Add-Blocker 'FE-23 posted receipt' "/api/farms/$farmId/trading-partners" 200 'supplier is absent; posted receipt was left absent'; $feedScenarioReady = $false }
    if ($stockItemId -le 0 -or $emptyItemId -le 0) { Add-Blocker 'FE-23 posted receipt' "/api/farms/$farmId/feed/catalogue" 200 'feed item IDs were not discovered/created; receipt was left absent'; $feedScenarioReady = $false }
    if ($null -eq $pen) { Add-Blocker 'FE-23 future ration' "/api/farms/$farmId/pens?status=ACTIVE" 200 'no active pen is available; ration was left absent'; $feedScenarioReady = $false }

    if ($feedScenarioReady) {
        if ($null -eq $receipt) {
            $receipt = Invoke-Api POST "/api/farms/$farmId/feed/receipts" $receiptBody "$SeedPrefix:receipt"
            Write-Host "Created posted receipt (status=$($receipt.status))."
        }
        if ($receipt.status -eq 'DRAFT') {
            $receipt = Invoke-Api POST "/api/farms/$farmId/feed/receipts/$($receipt.id)/post" @{ expectedVersion = [int]$receipt.version } "$SeedPrefix:receipt-post"
            Write-Host "Posted existing deterministic receipt (id=$($receipt.id))."
        }
        $receipt = Invoke-Api GET "/api/farms/$farmId/feed/receipts/$($receipt.id)"
        if ($receipt.status -ne 'POSTED') { Add-Blocker 'FE-23 posted receipt' "/api/farms/$farmId/feed/receipts/$($receipt.id)" 200 'receipt readback did not prove POSTED status'; $feedScenarioReady = $false }

        if ($feedScenarioReady -and $null -eq $ration) {
            $ration = Invoke-Api POST "/api/farms/$farmId/feed/rations" $rationBody "$SeedPrefix:ration"
            Write-Host "Created future ration (effectiveFrom=$($ration.effectiveFrom))."
        }
        if ($feedScenarioReady -and $null -ne $ration -and [string]$ration.status -notin @('SCHEDULED', 'EFFECTIVE', 'ENDED')) { Add-Blocker 'FE-23 future ration' "/api/farms/$farmId/feed/rations" 200 'ration readback has an unsupported status'; $feedScenarioReady = $false }
    }

    if ($null -eq $event -and $female -and -not $historyFailed) {
        $eventBody = @{ expectedCattleVersion = [int]$female.version; observedAt = [DateTime]::UtcNow.AddHours(-2).ToString('o'); signs = @('STANDING', 'MUCUS'); description = "$SeedPrefix breeding-window"; dataSource = 'LOCAL_DEMO_SEED'; confirmDuplicate = $false }
        $event = Invoke-Api POST "/api/farms/$farmId/cattle/$($female.id)/estrus-events" $eventBody "$SeedPrefix:estrus"
        Write-Host "Created FE-14 reproduction event (id=$($event.eventId))."
    }
}

# FE-07 is applied after farm/member preflight; each scenario reports its own
# blocker and leaves unsupported data absent without stopping other scenarios.
$announcement = $existingAnnouncement
if ($null -eq $announcement -and $Apply) {
    if ($technicians.Count -eq 0) { Stop-Seed 'Cannot apply FE-07 without an active technician recipient.' }
    $announcement = Invoke-Api POST "/api/farms/$farmId/announcements/drafts" @{ title = "$SeedPrefix FE-07 announcement"; body = 'Local demo announcement for FE-07.'; recipientRoles = @('TECHNICIAN'); recipientMemberIds = @($technicians | ForEach-Object { [long]$_.id }); expectedVersion = $null } "$SeedPrefix:announcement-draft"
    Write-Host "Created FE-07 draft (id=$($announcement.id))."
}
if ($null -ne $announcement -and $Apply -and $announcement.state -eq 'DRAFT') {
    $announcement = Invoke-Api POST "/api/farms/$farmId/announcements/$($announcement.id)/publish" @{ expectedVersion = [int]$announcement.version } "$SeedPrefix:announcement-publish"
    Write-Host "Published FE-07 announcement (id=$($announcement.id))."
}
if ($null -ne $announcement -and $Apply -and $announcement.state -eq 'PUBLISHED' -and @($announcement.versions).Count -lt 2) {
    $announcement = Invoke-Api POST "/api/farms/$farmId/announcements/$($announcement.id)/corrections" @{ title = "$SeedPrefix FE-07 correction"; body = 'Corrected local demo announcement for FE-07.'; reason = 'Local demo correction'; expectedVersion = [int]$announcement.version } "$SeedPrefix:announcement-correction"
    Write-Host "Published FE-07 correction (id=$($announcement.id))."
}
if ($null -ne $announcement -and $Apply) {
    $announcement = Invoke-Api GET "/api/farms/$farmId/announcements/$($announcement.id)"
    $script:readbacks['announcement'] = [ordered]@{ id = $announcement.id; state = $announcement.state; versions = @($announcement.versions).Count; deliveries = @($announcement.deliveries).Count }
    if (@($announcement.versions).Count -lt 2 -or @($announcement.deliveries).Count -lt 1) { Add-Blocker 'FE-07 recipient delivery' "/api/farms/$farmId/announcements/$($announcement.id)" 200 'published correction or recipient delivery is absent in readback' }
    $delivery = Find-One @($announcement.deliveries) { $_.status -eq 'DELIVERED' } 'unread announcement delivery'
    if ($delivery) { Invoke-Api POST "/api/farms/$farmId/announcements/recipients/$($delivery.recipientId)/read" @{} "$SeedPrefix:announcement-read" | Out-Null }
}

$stockResponse = Invoke-Api GET "/api/farms/$farmId/feed/stock" -AllowFailure
$stockRows = if (Is-ApiFailure $stockResponse) { @() } else { Get-Items $stockResponse 'stock readback' }
$stockReadbackFailed = Is-ApiFailure $stockResponse
if ($Apply -and $stockReadbackFailed) { Add-Blocker 'FE-23 stock readback' "/api/farms/$farmId/feed/stock" $stockResponse.status 'stock route was unavailable' }
$stocked = if ($stockItemId -gt 0) { Find-One $stockRows { [long]$_.feedItemId -eq $stockItemId } 'stocked feed item' } else { $null }
$empty = if ($emptyItemId -gt 0) { Find-One $stockRows { [long]$_.feedItemId -eq $emptyItemId } 'out-of-stock feed item' } else { $null }
if ($Apply -and $stocked -and [decimal]$stocked.onHandKg -le 0) { Add-Blocker 'FE-23 posted receipt' "/api/farms/$farmId/feed/stock" 200 'posted receipt did not produce positive stock' }
if ($Apply -and $empty -and [decimal]$empty.onHandKg -ne 0) { Add-Blocker 'FE-23 out-of-stock contrast' "/api/farms/$farmId/feed/stock" 200 'sentinel out-of-stock feed item is not at zero stock' }

$feedReminderResponse = Invoke-Api GET "/api/farms/$farmId/feed/reminders" -AllowFailure
$feedReminderRows = if (Is-ApiFailure $feedReminderResponse) { @() } else { Get-Items $feedReminderResponse 'feed reminder readback' }
$feedReminderReadbackFailed = Is-ApiFailure $feedReminderResponse
$ifApplyFeedReminderBlock = $Apply -and $feedReminderReadbackFailed
if ($ifApplyFeedReminderBlock) { Add-Blocker 'FE-14 low-stock reminder' "/api/farms/$farmId/feed/reminders" $feedReminderResponse.status 'feed reminder route was unavailable' }
$lowStockReminder = Find-One $feedReminderRows { $_.ruleType -eq 'REM-10' -and $emptyItemId -gt 0 -and [long]$_.feedItemId -eq $emptyItemId } 'FE-14 low-stock reminder'
if ($Apply -and -not $feedReminderReadbackFailed -and $null -eq $lowStockReminder) { Add-Blocker 'FE-14 low-stock reminder' "/api/farms/$farmId/feed/reminders" 200 'REM-10 for the deterministic out-of-stock feed item was not returned' }
$reminderResponse = Invoke-Api GET "/api/farms/$farmId/reminders" -AllowFailure
$reminderRows = if (Is-ApiFailure $reminderResponse) { @() } else { Get-Items $reminderResponse 'farm reminder readback' }
$reminderReadbackFailed = Is-ApiFailure $reminderResponse
if ($Apply -and $reminderReadbackFailed) { Add-Blocker 'FE-14 breeding-window reminder' "/api/farms/$farmId/reminders" $reminderResponse.status 'farm reminder route was unavailable' }
$eventIdValue = Get-OptionalProperty $event 'eventId'
if ($null -eq $eventIdValue) { $eventIdValue = Get-OptionalProperty $event 'id' }
$eventId = if ($null -ne $eventIdValue) { [long]$eventIdValue } else { 0 }
$normalReminder = if ($eventId -gt 0) { Find-Any $reminderRows { $_.ruleType -eq 'REM-02' -and $_.sourceId -eq "REPRODUCTION_EVENT:$eventId" } } else { $null }
if ($Apply -and -not $reminderReadbackFailed -and $null -eq $normalReminder) {
    Add-Blocker 'FE-14 breeding-window reminder' "/api/farms/$farmId/reminders" 200 'the estrus source exists but REM-02 has not been reconciled; JOB-01 has no on-demand HTTP route, so rerun after its next 15-minute cycle'
}

$from = $today.AddDays(-30).ToString('yyyy-MM-dd'); $to = $today.ToString('yyyy-MM-dd')
$dashboard = Invoke-Api GET "/api/farms/$farmId/dashboard?from=$from&to=$to" -AllowFailure
if (Is-ApiFailure $dashboard) { Add-Blocker 'FE-15 dashboard source/readback' "/api/farms/$farmId/dashboard" $dashboard.status 'dashboard endpoint was unavailable' }
$report = $null
if ($Apply) {
    $report = Invoke-Api POST "/api/farms/$farmId/dashboard/reports" @{ reportType = 'RPT-01'; from = $from; to = $to; penIds = @(); breedIds = @(); herdGroups = @(); lifeStages = @() } -AllowFailure
    if (Is-ApiFailure $report) { Add-Blocker 'FE-15 report output' "/api/farms/$farmId/dashboard/reports" $report.status 'RPT-01 report endpoint was unavailable' }
} else {
    Write-Host "  Planned FE-15 report: POST /api/farms/$farmId/dashboard/reports (RPT-01, $from..$to; skipped in dry-run)"
}
if (-not (Is-ApiFailure $dashboard)) {
    $script:readbacks['dashboard'] = [ordered]@{ activeCattle = $dashboard.activeCattle; generatedAt = [bool]$dashboard.generatedAt }
    if ($Apply -and [long]$dashboard.activeCattle -le 0) { Add-Blocker 'FE-15 dashboard source/readback' "/api/farms/$farmId/dashboard" 200 'dashboard returned no active cattle source data' }
}
if ($null -ne $report -and -not (Is-ApiFailure $report)) { $script:readbacks['report'] = [ordered]@{ reportType = $report.reportType; rows = @($report.rows).Count; generatedAt = [bool]$report.generatedAt; unavailableData = @($report.unavailableData).Count } }

Write-Host "Readback summary (sanitized):"
foreach ($key in $script:readbacks.Keys) { Write-Host ("  {0}: {1}" -f $key, (($script:readbacks[$key] | ConvertTo-Json -Compress -Depth 5))) }
if ($script:blockers.Count -gt 0) {
    Write-Warning "Seed completed with $($script:blockers.Count) reported blocker(s); unsupported scenarios were left absent."
    exit 2
}
Write-Host 'Seed plan/readback completed without reported blockers.'
