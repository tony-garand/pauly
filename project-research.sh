#!/bin/bash

# Project Research & Competitive Analysis
# Analyzes your projects and researches similar tools/improvements

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECTS_DIR="$HOME/Projects"
RESEARCH_CACHE="$SCRIPT_DIR/cache/research"

mkdir -p "$RESEARCH_CACHE"

main() {
    log "Starting Project Research & Analysis"

    ensure_claude || return 1

    local report="Project Research Report - $(date '+%Y-%m-%d')\n"
    report+="==========================================\n\n"

    # Find projects with package.json, Cargo.toml, pyproject.toml, etc.
    local projects_analyzed=0

    for project_dir in "$PROJECTS_DIR"/*/; do
        [ ! -d "$project_dir" ] && continue

        local project_name=$(basename "$project_dir")
        local project_type=""
        local project_desc=""

        # Skip the ai-assistant project itself
        [ "$project_name" = "ai-assistant" ] && continue

        # Detect project type and get description
        if [ -f "$project_dir/package.json" ]; then
            project_type="node"
            project_desc=$(cat "$project_dir/package.json" | grep -m1 '"description"' | sed 's/.*"description"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        elif [ -f "$project_dir/Cargo.toml" ]; then
            project_type="rust"
            project_desc=$(grep -m1 '^description' "$project_dir/Cargo.toml" | sed 's/description[[:space:]]*=[[:space:]]*"\([^"]*\)"/\1/')
        elif [ -f "$project_dir/pyproject.toml" ]; then
            project_type="python"
            project_desc=$(grep -m1 '^description' "$project_dir/pyproject.toml" | sed 's/description[[:space:]]*=[[:space:]]*"\([^"]*\)"/\1/')
        elif [ -f "$project_dir/setup.py" ]; then
            project_type="python"
        elif [ -f "$project_dir/go.mod" ]; then
            project_type="go"
        elif [ -f "$project_dir/README.md" ]; then
            project_type="unknown"
            project_desc=$(head -5 "$project_dir/README.md" | tail -4)
        else
            continue  # Skip directories without recognizable project files
        fi

        projects_analyzed=$((projects_analyzed + 1))
        log "Analyzing: $project_name ($project_type)"

        # Get README content for context
        local readme_content=""
        if [ -f "$project_dir/README.md" ]; then
            readme_content=$(head -100 "$project_dir/README.md")
        fi

        # Check if we've recently analyzed this project (within 7 days)
        local cache_file="$RESEARCH_CACHE/${project_name}.cache"
        local cache_age=999999
        if [ -f "$cache_file" ]; then
            cache_age=$(( ($(date +%s) - $(stat -f%m "$cache_file")) / 86400 ))
        fi

        if [ $cache_age -lt 7 ]; then
            log "Using cached research for $project_name (${cache_age}d old)"
            local analysis=$(cat "$cache_file")
        else
            # Ask Claude to research and analyze
            local analysis=$(claude --print "Analyze this project and provide competitive research:

Project: $project_name
Type: $project_type
Description: $project_desc

README excerpt:
$readme_content

Please provide:
1. **Similar Projects**: List 2-3 similar open-source projects or commercial products (with brief descriptions)
2. **Feature Gaps**: What features do competitors have that this project might benefit from?
3. **Improvement Suggestions**: 2-3 specific, actionable improvements based on industry trends
4. **Tech Stack Recommendations**: Any libraries, tools, or patterns worth considering

Keep each section brief (2-3 bullet points max). Focus on actionable insights." 2>/dev/null)

            # Cache the result
            echo "$analysis" > "$cache_file"
        fi

        report+="\n📦 $project_name\n"
        report+="────────────────────────────────────────\n"
        report+="$analysis\n\n"

    done

    if [ $projects_analyzed -eq 0 ]; then
        log "No projects found to analyze"
        report+="No projects with recognized structure found in $PROJECTS_DIR\n"
    else
        log "Analyzed $projects_analyzed projects"
    fi

    # Send email
    send_email "Weekly Project Research - $projects_analyzed projects" "$(echo -e "$report")"

    log "Project Research complete. Analyzed $projects_analyzed projects."
}

run_with_alerts "project-research" main
