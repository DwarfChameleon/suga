param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Message,
  [switch]$NoPush
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

Push-Location $repoRoot
try {
  git rev-parse --is-inside-work-tree | Out-Null
  git add -A
  $status = git status --porcelain
  if (-not $status) {
    Write-Host 'Nothing to commit.'
    exit 0
  }

  git commit -m $Message
  if (-not $NoPush) {
    git push
  }
}
finally {
  Pop-Location
}
