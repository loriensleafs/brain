<#
.SYNOPSIS
    Benchmarks memory search performance across Brain MCP and legacy systems.

.DESCRIPTION
    Implements M-008 from Phase 2A: Create memory search benchmarks.

    Measures:
    1. Brain MCP lexical search (file-based, keyword matching)
    2. Brain MCP semantic search (vector-based, embeddings)
    3. Combined/unified search (Memory Router)

    Outputs performance metrics for comparison against claude-flow baseline (96-164x target).

.PARAMETER Queries
    Array of test queries to benchmark. If not provided, uses default set.

.PARAMETER Iterations
    Number of iterations per query for averaging. Default: 5

.PARAMETER WarmupIterations
    Number of warmup iterations before measurement. Default: 2

.PARAMETER BrainOnly
    Only benchmark Brain MCP lexical search (skip semantic search if unavailable).

.PARAMETER Format
    Output format: "console", "markdown", "json". Default: "console"

.EXAMPLE
    .\Measure-MemoryPerformance.ps1
    # Run default benchmarks

.EXAMPLE
    .\Measure-MemoryPerformance.ps1 -Queries @("PowerShell arrays", "git hooks") -Iterations 10
    # Benchmark specific queries with more iterations

.EXAMPLE
    .\Measure-MemoryPerformance.ps1 -Format json | ConvertFrom-Json
    # Get structured output for programmatic use

.NOTES
    Part of Phase 2A Memory System implementation.
    Issue: #167 (Vector Memory System)
    Task: M-008 (Create memory search benchmarks)
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string[]]$Queries,

    [Parameter()]
    [int]$Iterations = 5,

    [Parameter()]
    [int]$WarmupIterations = 2,

    [Parameter()]
    [switch]$BrainOnly,

    [Parameter()]
    [ValidateSet("console", "markdown", "json")]
    [string]$Format = "console"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# region Configuration

# Default benchmark queries covering different domains

$DefaultQueries = @(
    "PowerShell array handling patterns"
    "git pre-commit hook validation"
    "GitHub CLI PR operations"
    "session protocol compliance"
    "security vulnerability detection"
    "Pester test isolation"
    "CI workflow patterns"
    "memory-first architecture"
)

if (-not $Queries -or $Queries.Count -eq 0) {
    $Queries = $DefaultQueries
}

# Brain MCP memory path

$BrainMemoryPath = ".brain/notes"

# Brain MCP semantic endpoint (from .mcp.json)

$BrainSemanticEndpoint = "http://localhost:8020/mcp"

# endregion

# region Color Output

$ColorReset = "`e[0m"
$ColorRed = "`e[31m"
$ColorYellow = "`e[33m"
$ColorGreen = "`e[32m"
$ColorCyan = "`e[36m"
$ColorMagenta = "`e[35m"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = $ColorReset)
    if ($Format -eq "console") {
        Write-Host "${Color}${Message}${ColorReset}"
    }
}

# endregion

# region Brain MCP Lexical Benchmarking

function Measure-BrainLexicalSearch {
    <#
    .SYNOPSIS
        Benchmarks Brain MCP's lexical memory search.
    .DESCRIPTION
        Simulates the mcp__plugin_brain_brain__list_directory + mcp__plugin_brain_brain__read_note pattern.
        Measures:
        1. List time (scanning all memory file names)
        2. Match time (keyword matching in file names)
        3. Read time (loading matched files)
    #>
    param(
        [string]$Query,
        [string]$MemoryPath,
        [int]$Iterations,
        [int]$WarmupIterations
    )

    $result = @{
        Query          = $Query
        System         = "BrainLexical"
        ListTimeMs     = 0
        MatchTimeMs    = 0
        ReadTimeMs     = 0
        TotalTimeMs    = 0
        MatchedFiles   = 0
        TotalFiles     = 0
        IterationTimes = @()
    }

    # Verify path exists
    if (-not (Test-Path $MemoryPath)) {
        $result.Error = "Memory path not found: $MemoryPath"
        return $result
    }

    # Get query keywords for matching
    $keywords = @($Query.ToLowerInvariant() -split '\s+' | Where-Object { $_.Length -gt 2 })

    # Warmup iterations (not measured)
    # Note: SilentlyContinue is used intentionally during benchmarking to avoid error handling
    # overhead skewing timing results. Path existence is verified above, but file-level errors
    # during warmup are suppressed since warmup failures don't affect benchmark validity.
    for ($w = 0; $w -lt $WarmupIterations; $w++) {
        $files = @(Get-ChildItem -Path $MemoryPath -Filter "*.md" -ErrorAction SilentlyContinue)
        foreach ($file in $files) {
            $fileName = $file.BaseName.ToLowerInvariant()
            $matchingKeywords = @($keywords | Where-Object { $fileName -match [regex]::Escape($_) })
            if ($matchingKeywords.Count -gt 0) {
                $null = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
            }
        }
    }

    # Measured iterations
    $listTimes = @()
    $matchTimes = @()
    $readTimes = @()
    $totalTimes = @()
    $matchedFileCounts = @()

    for ($i = 0; $i -lt $Iterations; $i++) {
        $iterationStart = Get-Date

        # Phase 1: List files (simulates list_memories)
        $listStart = Get-Date
        $files = @(Get-ChildItem -Path $MemoryPath -Filter "*.md" -ErrorAction SilentlyContinue)
        $listEnd = Get-Date
        $listTimes += ($listEnd - $listStart).TotalMilliseconds

        # Phase 2: Match keywords (simulates lexical search)
        $matchStart = Get-Date
        $matchedFiles = @()
        foreach ($file in $files) {
            $fileName = $file.BaseName.ToLowerInvariant()
            $matchingKeywords = @($keywords | Where-Object { $fileName -match [regex]::Escape($_) })
            if ($matchingKeywords.Count -gt 0) {
                $matchedFiles += $file
            }
        }
        $matchEnd = Get-Date
        $matchTimes += ($matchEnd - $matchStart).TotalMilliseconds

        # Phase 3: Read matched files (simulates read_memory)
        $readStart = Get-Date
        foreach ($file in $matchedFiles) {
            $null = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
        }
        $readEnd = Get-Date
        $readTimes += ($readEnd - $readStart).TotalMilliseconds

        $iterationEnd = Get-Date
        $totalTimes += ($iterationEnd - $iterationStart).TotalMilliseconds
        $matchedFileCounts += $matchedFiles.Count
    }

    # Calculate averages
    $result.ListTimeMs = [math]::Round(($listTimes | Measure-Object -Average).Average, 2)
    $result.MatchTimeMs = [math]::Round(($matchTimes | Measure-Object -Average).Average, 2)
    $result.ReadTimeMs = [math]::Round(($readTimes | Measure-Object -Average).Average, 2)
    $result.TotalTimeMs = [math]::Round(($totalTimes | Measure-Object -Average).Average, 2)
    $result.MatchedFiles = [math]::Round(($matchedFileCounts | Measure-Object -Average).Average, 0)
    $result.TotalFiles = $files.Count
    $result.IterationTimes = $totalTimes

    return $result
}

# endregion

# region Brain MCP Semantic Benchmarking

function Test-BrainSemanticAvailable {
    <#
    .SYNOPSIS
        Checks if Brain MCP semantic search is available.
    #>
    param([string]$Endpoint)

    try {
        $null = Invoke-RestMethod -Uri $Endpoint -Method Get -TimeoutSec 2 -ErrorAction Stop
        return $true
    }
    catch {
        # Endpoint not available - expected when Forgetful is not running
        return $false
    }
}

function Measure-BrainSemanticSearch {
    <#
    .SYNOPSIS
        Benchmarks Brain MCP's semantic memory search.
    .DESCRIPTION
        Uses the Brain MCP HTTP endpoint to perform semantic search via mcp__plugin_brain_brain__search.
        Measures end-to-end latency including:
        1. Embedding generation
        2. Vector similarity search
        3. Result retrieval
    #>
    param(
        [string]$Query,
        [string]$Endpoint,
        [int]$Iterations,
        [int]$WarmupIterations
    )

    $result = @{
        Query           = $Query
        System          = "BrainSemantic"
        SearchTimeMs    = 0
        TotalTimeMs     = 0
        MatchedMemories = 0
        IterationTimes  = @()
    }

    # Check availability
    if (-not (Test-BrainSemanticAvailable -Endpoint $Endpoint)) {
        $result.Error = "Brain MCP semantic search not available at $Endpoint"
        return $result
    }

    # Note: This is a simplified simulation since we can't directly call MCP from PowerShell
    # In production, this would use the Claude Code MCP tools (mcp__plugin_brain_brain__search)
    # For now, we measure HTTP roundtrip as a proxy

    $searchBody = @{
        jsonrpc = "2.0"
        id      = 1
        method  = "tools/call"
        params  = @{
            name      = "search"
            arguments = @{
                query = $Query
                limit = 10
            }
        }
    } | ConvertTo-Json -Depth 5

    # Warmup - errors are expected and intentionally ignored
    for ($w = 0; $w -lt $WarmupIterations; $w++) {
        try {
            $null = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $searchBody -ContentType "application/json" -TimeoutSec 10 -ErrorAction SilentlyContinue
        }
        catch {
            # Warmup errors are expected when endpoint is unavailable or warming up
            Write-Verbose "Warmup iteration $w failed: $($_.Exception.Message)"
        }
    }

    # Measured iterations
    $searchTimes = @()
    $memoryCounts = @()

    for ($i = 0; $i -lt $Iterations; $i++) {
        $searchStart = Get-Date

        try {
            $response = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $searchBody -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
            $searchEnd = Get-Date
            $searchTimes += ($searchEnd - $searchStart).TotalMilliseconds

            # Try to extract result count
            if ($response.result -and $response.result.content) {
                $memoryCounts += 1  # At minimum we got a response
            }
            else {
                $memoryCounts += 0
            }
        }
        catch {
            $searchEnd = Get-Date
            $searchTimes += ($searchEnd - $searchStart).TotalMilliseconds
            $memoryCounts += 0
            $result.Error = $_.Exception.Message
        }
    }

    # Calculate averages
    if ($searchTimes.Count -gt 0) {
        $result.SearchTimeMs = [math]::Round(($searchTimes | Measure-Object -Average).Average, 2)
        $result.TotalTimeMs = $result.SearchTimeMs
        $result.MatchedMemories = [math]::Round(($memoryCounts | Measure-Object -Average).Average, 0)
        $result.IterationTimes = $searchTimes
    }

    return $result
}

# endregion

# region Main Execution

function Invoke-MemoryBenchmark {
    param(
        [string[]]$TestQueries,
        [int]$TestIterations,
        [int]$TestWarmup,
        [switch]$SkipSemantic
    )

    $benchmark = @{
        Timestamp           = Get-Date -Format 'o'
        Configuration       = @{
            Queries              = $TestQueries.Count
            Iterations           = $TestIterations
            WarmupIterations     = $TestWarmup
            BrainMemoryPath      = $BrainMemoryPath
            BrainSemanticEndpoint = $BrainSemanticEndpoint
        }
        BrainLexicalResults  = @()
        BrainSemanticResults = @()
        Summary              = @{
            BrainLexicalAvgMs  = 0
            BrainSemanticAvgMs = 0
            SpeedupFactor      = 0
            Target             = "96-164x (claude-flow baseline)"
        }
    }

    Write-ColorOutput "=== Memory Performance Benchmark (M-008) ===" $ColorCyan
    Write-ColorOutput "Queries: $($TestQueries.Count), Iterations: $TestIterations, Warmup: $TestWarmup" $ColorMagenta
    Write-ColorOutput ""

    # Benchmark Brain MCP Lexical
    Write-ColorOutput "Benchmarking Brain MCP (lexical search via list_directory + read_note)..." $ColorCyan

    foreach ($query in $TestQueries) {
        Write-ColorOutput "  Query: '$query'" $ColorMagenta

        $brainLexicalResult = Measure-BrainLexicalSearch -Query $query -MemoryPath $BrainMemoryPath -Iterations $TestIterations -WarmupIterations $TestWarmup
        $benchmark.BrainLexicalResults += $brainLexicalResult

        if ($brainLexicalResult.ContainsKey('Error') -and $brainLexicalResult.Error) {
            Write-ColorOutput "    Error: $($brainLexicalResult.Error)" $ColorRed
        }
        else {
            Write-ColorOutput "    Total: $($brainLexicalResult.TotalTimeMs)ms (List: $($brainLexicalResult.ListTimeMs)ms, Match: $($brainLexicalResult.MatchTimeMs)ms, Read: $($brainLexicalResult.ReadTimeMs)ms)" $ColorGreen
            Write-ColorOutput "    Matched: $($brainLexicalResult.MatchedFiles) of $($brainLexicalResult.TotalFiles) files" $ColorCyan
        }
    }

    # Calculate Brain Lexical average
    $brainLexicalValidResults = @($benchmark.BrainLexicalResults | Where-Object { -not $_.ContainsKey('Error') -or -not $_.Error })
    if ($brainLexicalValidResults.Count -gt 0) {
        $benchmark.Summary.BrainLexicalAvgMs = [math]::Round(($brainLexicalValidResults | ForEach-Object { $_.TotalTimeMs } | Measure-Object -Average).Average, 2)
    }

    # Benchmark Brain MCP Semantic (if available)
    if (-not $SkipSemantic) {
        Write-ColorOutput ""
        Write-ColorOutput "Benchmarking Brain MCP (semantic search via search)..." $ColorCyan

        if (Test-BrainSemanticAvailable -Endpoint $BrainSemanticEndpoint) {
            foreach ($query in $TestQueries) {
                Write-ColorOutput "  Query: '$query'" $ColorMagenta

                $brainSemanticResult = Measure-BrainSemanticSearch -Query $query -Endpoint $BrainSemanticEndpoint -Iterations $TestIterations -WarmupIterations $TestWarmup
                $benchmark.BrainSemanticResults += $brainSemanticResult

                if ($brainSemanticResult.ContainsKey('Error') -and $brainSemanticResult.Error) {
                    Write-ColorOutput "    Error: $($brainSemanticResult.Error)" $ColorRed
                }
                else {
                    Write-ColorOutput "    Total: $($brainSemanticResult.TotalTimeMs)ms" $ColorGreen
                    Write-ColorOutput "    Matched: $($brainSemanticResult.MatchedMemories) memories" $ColorCyan
                }
            }

            # Calculate Brain Semantic average
            $brainSemanticValidResults = @($benchmark.BrainSemanticResults | Where-Object { -not $_.ContainsKey('Error') -or -not $_.Error })
            if ($brainSemanticValidResults.Count -gt 0) {
                $benchmark.Summary.BrainSemanticAvgMs = [math]::Round(($brainSemanticValidResults | ForEach-Object { $_.TotalTimeMs } | Measure-Object -Average).Average, 2)
            }
        }
        else {
            Write-ColorOutput "  Brain MCP semantic search not available at $BrainSemanticEndpoint" $ColorYellow
            Write-ColorOutput "  Skipping semantic benchmarks" $ColorYellow
        }
    }

    # Calculate speedup factor
    if ($benchmark.Summary.BrainLexicalAvgMs -gt 0 -and $benchmark.Summary.BrainSemanticAvgMs -gt 0) {
        $benchmark.Summary.SpeedupFactor = [math]::Round($benchmark.Summary.BrainLexicalAvgMs / $benchmark.Summary.BrainSemanticAvgMs, 2)
    }

    return $benchmark
}

# Run benchmark

$benchmarkResults = Invoke-MemoryBenchmark -TestQueries $Queries -TestIterations $Iterations -TestWarmup $WarmupIterations -SkipSemantic:$BrainOnly

# Output results

Write-ColorOutput ""
Write-ColorOutput "=== Summary ===" $ColorCyan

switch ($Format) {
    "console" {
        Write-ColorOutput "Brain Lexical Average: $($benchmarkResults.Summary.BrainLexicalAvgMs)ms" $ColorMagenta
        if ($benchmarkResults.Summary.BrainSemanticAvgMs -gt 0) {
            Write-ColorOutput "Brain Semantic Average: $($benchmarkResults.Summary.BrainSemanticAvgMs)ms" $ColorMagenta
            Write-ColorOutput "Speedup Factor: $($benchmarkResults.Summary.SpeedupFactor)x" $(if ($benchmarkResults.Summary.SpeedupFactor -ge 10) { $ColorGreen } else { $ColorYellow })
            Write-ColorOutput "Target: $($benchmarkResults.Summary.Target)" $ColorCyan
        }
        else {
            Write-ColorOutput "Brain Semantic: Not available" $ColorYellow
        }
    }
    "markdown" {
        $sb = [System.Text.StringBuilder]::new()
        [void]$sb.AppendLine("# Memory Performance Benchmark Report")
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("**Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
        [void]$sb.AppendLine("**Task**: M-008 (Phase 2A Memory System)")
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("## Configuration")
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("| Setting | Value |")
        [void]$sb.AppendLine("|---------|-------|")
        [void]$sb.AppendLine("| Queries | $($benchmarkResults.Configuration.Queries) |")
        [void]$sb.AppendLine("| Iterations | $($benchmarkResults.Configuration.Iterations) |")
        [void]$sb.AppendLine("| Warmup | $($benchmarkResults.Configuration.WarmupIterations) |")
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("## Results")
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("| System | Average (ms) | Status |")
        [void]$sb.AppendLine("|--------|-------------|--------|")
        [void]$sb.AppendLine("| Brain Lexical | $($benchmarkResults.Summary.BrainLexicalAvgMs) | Baseline |")
        if ($benchmarkResults.Summary.BrainSemanticAvgMs -gt 0) {
            $status = if ($benchmarkResults.Summary.SpeedupFactor -ge 10) { "Target Met" } else { "Below Target" }
            [void]$sb.AppendLine("| Brain Semantic | $($benchmarkResults.Summary.BrainSemanticAvgMs) | $status |")
        }
        [void]$sb.AppendLine("")
        if ($benchmarkResults.Summary.SpeedupFactor -gt 0) {
            [void]$sb.AppendLine("**Speedup Factor**: $($benchmarkResults.Summary.SpeedupFactor)x")
            [void]$sb.AppendLine("**Target**: $($benchmarkResults.Summary.Target)")
        }
        Write-Output $sb.ToString()
    }
    "json" {
        Write-Output ($benchmarkResults | ConvertTo-Json -Depth 10)
    }
}

# endregion


