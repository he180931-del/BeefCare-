# OBSOLETE: this draft uses an unverified route adapter. Do not apply it.
# Use beefcare-local-demo-seed-actual.ps1, which is fixed to the provided Java API contract.
[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$Apply,
    [string]$BaseUrl = $(if ($env:BEEFCARE_LOCAL_API_BASE_URL) { $env:BEEFCARE_LOCAL_API_BASE_URL } else { 'http://127.0.0.1:8080' }),
    [string]$FarmId = $env:BEEFCARE_LOCAL_FARM_ID,
    [string]$AuthToken = $env:BEEFCARE_LOCAL_API_TOKEN,
    [string]$SeedMarker = $(if ($env:BEEFCARE_LOCAL_SEED_MARKER) { $env:BEEFCARE_LOCAL_SEED_MARKER } else { 'beefcare-local-demo-feed-v1' }),
    [string]$ConfigPath = $(if ($env:BEEFCARE_LOCAL_SEED_CONFIG) { $env:BEEFCARE_LOCAL_SEED_CONFIG } else { Join-Path $PSScriptRoot 'beefcare-local-demo-seed.config.json' })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
    throw "[beefcare-local-demo-seed] $Message"
}

function Read-Config {
    if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
        Fail "Missing endpoint config '$ConfigPath'. Copy it from the checked-in example only after reconciling routes and field names with the installed local API."
    }
    try {
        $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    } catch {
        Fail "Endpoint config is not valid JSON: $($_.Exception.Message)"
    }
    foreach ($name in @('healthPath','stockReceiptsPath','effectiveRationsPath','feedingRecordsPath')) {
        if ([string]::IsNullOrWhiteSpace([string]$config.$name)) { Fail "Config field '$name' is required." }
    }
    return $config
}

function Assert-LocalOnly([uri]$Uri) {
    $allowed = @('localhost', '127.0.0.1', '::1')
    if ($Uri.Scheme -ne 'http' -or $allowed -notcontains $Uri.Host.ToLowerInvariant()) {
        Fail "Refusing non-local URL '$Uri'. This helper only permits http://localhost, http://127.0.0.1, or http://[::1]."
    }
}

function Join-Endpoint([uri]$Root, [string]$Path) {
    return [uri]::new($Root, $Path.TrimStart('/'))
}

function New-Headers {
    $headers = @{ Accept = 'application/json'; 'X-BeefCare-Seed-Marker' = $SeedMarker }
    if (-not [string]::IsNullOrWhiteSpace($AuthToken)) { $headers.Authorization = "Bearer $AuthToken" }
    return $headers
}

function Invoke-ApiJson([ValidateSet('GET','POST')] [string]$Method, [uri]$Uri, $Body = $null) {
    $headers = New-Headers
    $args = @{ Method = $Method; Uri = $Uri.AbsoluteUri; Headers = $headers; ErrorAction = 'Stop' }
    if ($null -ne $Body) {
        $args.ContentType = 'application/json'
        $args.Body = ($Body | ConvertTo-Json -Depth 20)
    }
    try {
        return Invoke-RestMethod @args
    } catch {
        Fail "$Method $Uri failed: $($_.Exception.Message)"
    }
}

function Get-ResourceByMarker([uri]$CollectionUri) {
    # The installed API must support these two filters. If it does not, update the
    # config/query template from the real runtime helper before using -Apply.
    $separator = if ($CollectionUri.AbsoluteUri.Contains('?')) { '&' } else { '?' }
    $uri = [uri]::new($CollectionUri.AbsoluteUri + $separator + 'farmId=' + [uri]::EscapeDataString($FarmId) + '&seedMarker=' + [uri]::EscapeDataString($SeedMarker))
    $result = Invoke-ApiJson -Method GET -Uri $uri
    if ($null -eq $result) { return $null }
    $items = $null
    if ($result.PSObject.Properties.Name -contains 'items') { $items = @($result.items) }
    elseif ($result.PSObject.Properties.Name -contains 'data' -and $result.data -is [array]) { $items = @($result.data) }
    elseif ($result.PSObject.Properties.Name -contains 'data' -and $result.data -and ($result.data.PSObject.Properties.Name -contains 'items')) { $items = @($result.data.items) }
    elseif ($result -is [array]) { $items = @($result) }
    elseif ($result.PSObject.Properties.Name -contains 'id') { $items = @($result) }
    else { Fail "Cannot prove the marker-filtered response shape for $CollectionUri. Update the config/helper from the installed API before applying." }

    $matches = @($items | Where-Object {
        [string]$_.farmId -eq $FarmId -and [string]$_.seedMarker -eq $SeedMarker
    })
    if ($matches.Count -gt 1) { Fail "More than one '$SeedMarker' resource exists for farm '$FarmId' at $CollectionUri; refusing to choose." }
    if ($matches.Count -eq 1) { return $matches[0] }
    return $null
}

function Assert-SameFarm($Resource, [string]$Label) {
    if ($null -eq $Resource) { return }
    $returnedFarm = [string]$Resource.farmId
    if ([string]::IsNullOrWhiteSpace($returnedFarm) -or $returnedFarm -ne $FarmId) {
        Fail "$Label response did not prove farmId '$FarmId' (returned '$returnedFarm'). Refusing to continue."
    }
}

function Assert-ResourceIdentity($Resource, [string]$Label) {
    Assert-SameFarm $Resource $Label
    $returnedMarker = [string]$Resource.seedMarker
    if (-not [string]::IsNullOrWhiteSpace($returnedMarker) -and $returnedMarker -ne $SeedMarker) {
        Fail "$Label response returned seedMarker '$returnedMarker', expected '$SeedMarker'."
    }
    if ([string]::IsNullOrWhiteSpace([string]$Resource.id)) { Fail "$Label response has no id." }
}

Fail 'Obsolete draft disabled. Use scripts/tools/beefcare-local-demo-seed-actual.ps1, which uses the provided FeedManagementResource DTOs and routes.'

if ([string]::IsNullOrWhiteSpace($FarmId)) { Fail 'FarmId is required. Set BEEFCARE_LOCAL_FARM_ID; it is never guessed.' }
if ($FarmId -match '[,;\s]') { Fail 'FarmId contains whitespace or separators; refusing ambiguous cross-farm input.' }
if ([string]::IsNullOrWhiteSpace($SeedMarker) -or $SeedMarker -notmatch '^beefcare-local-demo-[a-z0-9-]+$') {
    Fail "SeedMarker must match '^beefcare-local-demo-[a-z0-9-]+$'."
}
$root = try { [uri]$BaseUrl } catch { Fail "BaseUrl '$BaseUrl' is not a valid URI." }
Assert-LocalOnly $root
$config = Read-Config

$receiptNo = "BC-LOCAL-DEMO-$SeedMarker"
$effectiveFrom = '2026-01-15'
$feedingDate = '2026-01-16'
$stockBody = [ordered]@{
    farmId = $FarmId
    seedMarker = $SeedMarker
    receiptNo = $receiptNo
    receivedAt = $effectiveFrom
    supplierName = 'BeefCare local demo'
    lines = @(@{
        feedItemCode = 'DEMO-HAY'
        feedItemName = 'Demo hay'
        quantity = 100
        unit = 'kg'
        unitCost = 1.0
    })
}

Write-Host "Local-only seed plan (dry run unless -Apply): $SeedMarker"
Write-Host "  Base URL: $root"
Write-Host "  Farm: $FarmId"
Write-Host "  Sequence: stock receipt -> effective ration -> feeding record"
Write-Host "  Data intent: 100 kg stock; 10 head x 5 kg/day ration; 50 kg feeding record for REM-10/11"

if (-not $Apply) {
    Write-Host 'No writes performed. Re-run with -Apply only against the isolated local stack after coordinator verification.'
    return
}
if ($env:BEEFCARE_LOCAL_SEED_APPLY -ne '1') {
    Fail 'Apply guard is closed. Set BEEFCARE_LOCAL_SEED_APPLY=1 in the isolated local shell and pass -Apply.'
}
if (-not ($config.PSObject.Properties.Name -contains 'verified') -or [bool]$config.verified -ne $true) {
    Fail "Config is not marked verified. Reconcile routes and payloads with the installed local API, then set verified=true in the local config file."
}

# Guard the service before any write. The health request is intentionally first.
$health = Invoke-ApiJson -Method GET -Uri (Join-Endpoint $root $config.healthPath)
if ($config.healthExpectedStatus -and [string]$health.status -ne [string]$config.healthExpectedStatus) {
    Fail "Health response status '$($health.status)' did not match '$($config.healthExpectedStatus)'."
}

$receiptUri = Join-Endpoint $root $config.stockReceiptsPath
$receipt = Get-ResourceByMarker $receiptUri
if ($null -eq $receipt) {
    $receipt = Invoke-ApiJson -Method POST -Uri $receiptUri -Body $stockBody
    Write-Host "Created stock receipt $($receipt.id)"
} else { Write-Host "Reusing stock receipt $($receipt.id)" }
Assert-ResourceIdentity $receipt 'Stock receipt'

$rationBody = [ordered]@{
    farmId = $FarmId
    seedMarker = $SeedMarker
    name = 'BeefCare local demo effective ration'
    effectiveFrom = $effectiveFrom
    sourceStockReceiptId = $receipt.id
    targetAnimalCount = 10
    lines = @(@{ feedItemCode = 'DEMO-HAY'; quantityPerHeadPerDay = 5; unit = 'kg' })
}
$rationUri = Join-Endpoint $root $config.effectiveRationsPath
$ration = Get-ResourceByMarker $rationUri
if ($null -eq $ration) {
    $ration = Invoke-ApiJson -Method POST -Uri $rationUri -Body $rationBody
    Write-Host "Created effective ration $($ration.id)"
} else { Write-Host "Reusing effective ration $($ration.id)" }
Assert-ResourceIdentity $ration 'Effective ration'

$feedingBody = [ordered]@{
    farmId = $FarmId
    seedMarker = $SeedMarker
    feedingDate = $feedingDate
    rationId = $ration.id
    animalCount = 10
    quantity = 50
    unit = 'kg'
    source = 'LOCAL_DEMO_SEED'
}
$feedingUri = Join-Endpoint $root $config.feedingRecordsPath
$feeding = Get-ResourceByMarker $feedingUri
if ($null -eq $feeding) {
    $feeding = Invoke-ApiJson -Method POST -Uri $feedingUri -Body $feedingBody
    Write-Host "Created feeding record $($feeding.id)"
} else { Write-Host "Reusing feeding record $($feeding.id)" }
Assert-ResourceIdentity $feeding 'Feeding record'
Write-Host 'Seed sequence complete. Verify stored values and REM-10/11 readbacks before calling this accepted.'
