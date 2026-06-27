param(
    [string]$Python = "",
    [switch]$DryRun,
    [switch]$CheckDataOnly,
    [switch]$SkipDataCheck
)

$ErrorActionPreference = "Stop"
$env:PYTHONUNBUFFERED = "1"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExperimentDir = Split-Path -Parent $ScriptDir
$RepoRoot = Resolve-Path (Join-Path $ExperimentDir "..")
$TrainingProcessDirName = -join ([char]0x8bad, [char]0x7ec3, [char]0x8fc7, [char]0x7a0b)
$TrainingResultsDirName = -join ([char]0x8bad, [char]0x7ec3, [char]0x7ed3, [char]0x679c)
$LogDir = Join-Path $ExperimentDir $TrainingProcessDirName
$ResultsDir = Join-Path (Join-Path $RepoRoot "models") $TrainingResultsDirName
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LogPath = Join-Path $LogDir "run_all_phasewarp_5seed_$Timestamp.log"

$ResolvedPython = $Python
if ([string]::IsNullOrWhiteSpace($ResolvedPython)) {
    $CondaPython = $null
    if ($env:CONDA_PREFIX) {
        $CondaEnvName = Split-Path -Leaf $env:CONDA_PREFIX
        if ($CondaEnvName -ne "Anaconda") {
            $CondaPython = Join-Path $env:CONDA_PREFIX "python.exe"
        }
    }

    if ($CondaPython -and (Test-Path -LiteralPath $CondaPython)) {
        $ResolvedPython = $CondaPython
    }
    elseif (Test-Path -LiteralPath "D:\Anaconda\envs\Ozone\python.exe") {
        $ResolvedPython = "D:\Anaconda\envs\Ozone\python.exe"
    }
    elseif (Test-Path -LiteralPath "D:\Anaconda\envs\ozone\python.exe") {
        $ResolvedPython = "D:\Anaconda\envs\ozone\python.exe"
    }
    else {
        $ResolvedPython = "python"
    }
}

$Scripts = @(
    "autoformer_phasewarp_compare.py",
    "convlstm_phasewarp_compare.py",
    "crossformer_phasewarp_compare.py",
    "dlinear_phasewarp_compare.py",
    "earthformer_phasewarp_compare.py",
    "etsformer_phasewarp_compare.py",
    "fedformer_phasewarp_compare.py",
    "informer_phasewarp_compare.py",
    "itransformer_phasewarp_compare.py",
    "mau_phasewarp_compare.py",
    "nbeats_phasewarp_compare.py",
    "nhits_phasewarp_compare.py",
    "patchtst_phasewarp_compare.py",
    "predrnnpp_phasewarp_compare.py",
    "predrnnv2_phasewarp_compare.py",
    "pyraformer_phasewarp_compare.py",
    "simvp_phasewarp_compare.py",
    "timemixer_phasewarp_compare.py",
    "timexer_phasewarp_compare.py",
    "tsmixer_phasewarp_compare.py"
)

$ScriptPaths = foreach ($Name in $Scripts) {
    $Path = Join-Path $ScriptDir $Name
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing training script: $Path"
    }
    $Path
}

function Test-ScriptCompleted {
    param(
        [string]$ScriptPath,
        [string]$ResultsDir
    )

    $Name = Split-Path -Leaf $ScriptPath
    if ($Name -notmatch '^(?<ModelTag>.+)_phasewarp_compare\.py$') {
        return $false
    }

    $ModelTag = $Matches["ModelTag"].ToLowerInvariant()
    foreach ($Seed in 11, 22, 33, 44, 55) {
        $ExpectedPaths = @(
            (Join-Path $ResultsDir "${ModelTag}_raw_seed$Seed.pth"),
            (Join-Path $ResultsDir "${ModelTag}_phasewarp_seed$Seed.pth")
        )
        foreach ($Path in $ExpectedPaths) {
            if (-not (Test-Path -LiteralPath $Path)) {
                return $false
            }
        }
    }

    return $true
}

if ($DryRun) {
    Write-Host "Dry run only. The following scripts would run with Python: $ResolvedPython"
    foreach ($Path in $ScriptPaths) {
        Write-Host $Path
    }
    exit 0
}

if (-not $SkipDataCheck) {
    $OpenMarsDir = Join-Path $RepoRoot "Dataset\OpenMars"
    $McdAllDir = Join-Path $RepoRoot "Dataset\MCDALL"
    if (-not ((Test-Path -LiteralPath $OpenMarsDir) -and (Test-Path -LiteralPath $McdAllDir))) {
        $OpenMarsDir = Join-Path $RepoRoot "data\OpenMars"
        $McdAllDir = Join-Path $RepoRoot "data\MCDALL"
    }
    $MissingDataDirs = @()

    if (-not (Test-Path -LiteralPath $OpenMarsDir)) {
        $MissingDataDirs += $OpenMarsDir
    }
    if (-not (Test-Path -LiteralPath $McdAllDir)) {
        $MissingDataDirs += $McdAllDir
    }

    if ($MissingDataDirs.Count -gt 0) {
        Write-Host "Missing input data directories required by these legacy cross-architecture scripts:"
        foreach ($Path in $MissingDataDirs) {
            Write-Host "  $Path"
        }
        Write-Host ""
        Write-Host "Current scripts call load_aligned_cube(base_dir), which expects Dataset\OpenMars and Dataset\MCDALL."
        Write-Host "This workspace also supports the existing fallback paths data\OpenMars and data\MCDALL."
        Write-Host "If you intentionally want to bypass this preflight check, rerun with -SkipDataCheck."
        exit 1
    }

    Write-Host "Using OpenMars data: $OpenMarsDir"
    Write-Host "Using MCDALL data: $McdAllDir"

    if ($CheckDataOnly) {
        Write-Host "Data check passed. Training was not started."
        exit 0
    }
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Push-Location $RepoRoot
try {
    "Run started: $(Get-Date -Format o)" | Tee-Object -FilePath $LogPath
    "Python: $ResolvedPython" | Tee-Object -FilePath $LogPath -Append
    "Repository: $RepoRoot" | Tee-Object -FilePath $LogPath -Append
    "Log: $LogPath" | Tee-Object -FilePath $LogPath -Append
    & $ResolvedPython -c "import sys, torch; print('Python executable:', sys.executable); print('Torch:', torch.__version__); print('Torch CUDA build:', torch.version.cuda); print('CUDA available:', torch.cuda.is_available()); print('CUDA device count:', torch.cuda.device_count()); print('CUDA device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')" 2>&1 |
        ForEach-Object { $_.ToString() } |
        Tee-Object -FilePath $LogPath -Append

    foreach ($ScriptPath in $ScriptPaths) {
        $Name = Split-Path -Leaf $ScriptPath
        "" | Tee-Object -FilePath $LogPath -Append
        "===== $Name =====" | Tee-Object -FilePath $LogPath -Append

        if (Test-ScriptCompleted -ScriptPath $ScriptPath -ResultsDir $ResultsDir) {
            "Skipping completed script: $Name" | Tee-Object -FilePath $LogPath -Append
            continue
        }

        $PreviousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $ResolvedPython $ScriptPath 2>&1 |
                ForEach-Object { $_.ToString() } |
                Tee-Object -FilePath $LogPath -Append
        }
        finally {
            $ErrorActionPreference = $PreviousErrorActionPreference
        }

        if ($LASTEXITCODE -ne 0) {
            throw "$Name failed with exit code $LASTEXITCODE. See log: $LogPath"
        }
    }

    "" | Tee-Object -FilePath $LogPath -Append
    "Run finished: $(Get-Date -Format o)" | Tee-Object -FilePath $LogPath -Append
}
finally {
    Pop-Location
}
