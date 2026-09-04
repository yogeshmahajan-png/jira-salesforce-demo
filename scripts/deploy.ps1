[CmdletBinding()]
param(
    [string]$TargetOrg = "",
    [string]$Manifest = "manifest\package.xml",
    [string]$DestructiveChanges = ""
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($TargetOrg)) {
    $TargetOrg = (Get-Content ".sf\config.json" -Raw | ConvertFrom-Json).'target-org'
}
if ([string]::IsNullOrWhiteSpace($TargetOrg)) {
    throw "Target org is required. Use -TargetOrg <development-org>."
}
if (-not (Test-Path $Manifest)) {
    throw "Manifest not found: $Manifest"
}

$arguments = @(
    "project", "deploy", "start",
    "--manifest", $Manifest,
    "--target-org", $TargetOrg,
    "--concise", "--json"
)
if (-not [string]::IsNullOrWhiteSpace($DestructiveChanges)) {
    if (-not (Test-Path $DestructiveChanges)) {
        throw "Destructive changes manifest not found: $DestructiveChanges"
    }
    $arguments += @("--post-destructive-changes", $DestructiveChanges)
}

$output = & sf @arguments
if ($LASTEXITCODE -ne 0) {
    try {
        $failure = $output | ConvertFrom-Json
        throw "Deployment failed: $($failure.message)"
    } catch {
        if ($_.Exception.Message -like "Deployment failed:*") {
            throw
        }
        throw "Deployment failed (sf exit code $LASTEXITCODE)."
    }
}

$result = $output | ConvertFrom-Json
$deploy = $result.result
if (-not $deploy.success) {
    throw "Deployment failed: $($deploy.status)"
}

"Deployment succeeded: $($deploy.id)"
"Target: $TargetOrg"
"Components: $($deploy.numberComponentsDeployed)/$($deploy.numberComponentsTotal)"
if ($deploy.details.componentSuccesses) {
    $deleted = @($deploy.details.componentSuccesses | Where-Object { $_.deleted })
    if ($deleted.Count -gt 0) {
        "Deleted: $(( $deleted | ForEach-Object { $_.fullName }) -join ', ')"
    }
}
