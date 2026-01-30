#!/bin/bash

# Railway helper functions for Pauly
# Source this file: source "$(dirname "$0")/lib/railway.sh"

# ==========================================
# Railway CLI Detection
# ==========================================

ensure_railway() {
    if command -v railway &> /dev/null; then
        return 0
    fi

    # Check common locations (cron doesn't have full PATH)
    local railway_paths=(
        "$HOME/.local/bin/railway"
        "/usr/local/bin/railway"
        "$HOME/.railway/bin/railway"
    )

    for path in "${railway_paths[@]}"; do
        if [ -x "$path" ]; then
            export PATH="$(dirname "$path"):$PATH"
            return 0
        fi
    done

    log_error "Railway CLI not found. Install with: bash <(curl -fsSL cli.new)"
    return 1
}

railway_is_authenticated() {
    railway whoami &>/dev/null
    return $?
}

# ==========================================
# Railway Deploy
# ==========================================

railway_deploy() {
    local project_dir="${1:-.}"
    local detach="${2:-false}"

    ensure_railway || return 1

    # Change to project directory if specified
    if [ "$project_dir" != "." ]; then
        if [ ! -d "$project_dir" ]; then
            log_error "Project directory not found: $project_dir"
            return 1
        fi
        cd "$project_dir" || return 1
    fi

    # Check authentication
    if ! railway_is_authenticated; then
        log_error "Not authenticated with Railway. Run 'railway login' first."
        return 1
    fi

    # Check if project is linked
    if ! railway status &>/dev/null; then
        log_error "Project not linked to Railway. Run 'railway link' first."
        return 1
    fi

    log "Deploying to Railway..."

    if [ "$detach" = "true" ] || [ "$detach" = "--detach" ]; then
        railway up --detach
    else
        railway up
    fi

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        log "Deployment initiated successfully"
    else
        log_error "Deployment failed with exit code $exit_code"
    fi

    return $exit_code
}

# ==========================================
# Railway Link
# ==========================================

railway_link() {
    local project_id="${1:-}"
    local project_dir="${2:-.}"

    ensure_railway || return 1

    # Change to project directory if specified
    if [ "$project_dir" != "." ]; then
        if [ ! -d "$project_dir" ]; then
            log_error "Project directory not found: $project_dir"
            return 1
        fi
        cd "$project_dir" || return 1
    fi

    # Check authentication
    if ! railway_is_authenticated; then
        log_error "Not authenticated with Railway. Run 'railway login' first."
        return 1
    fi

    log "Linking to Railway project..."

    if [ -n "$project_id" ]; then
        railway link "$project_id"
    else
        railway link
    fi

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        log "Project linked successfully"
    else
        log_error "Failed to link project"
    fi

    return $exit_code
}

# ==========================================
# Railway Status
# ==========================================

railway_status() {
    local project_dir="${1:-.}"

    ensure_railway || return 1

    # Change to project directory if specified
    if [ "$project_dir" != "." ]; then
        if [ ! -d "$project_dir" ]; then
            log_error "Project directory not found: $project_dir"
            return 1
        fi
        cd "$project_dir" || return 1
    fi

    # Check authentication
    if ! railway_is_authenticated; then
        echo "Authentication: Not logged in"
        echo "Run 'railway login' to authenticate"
        return 1
    fi

    echo "Authentication: Logged in as $(railway whoami 2>/dev/null)"
    echo ""

    # Get project status
    railway status
    return $?
}

# ==========================================
# Railway Logs
# ==========================================

railway_logs() {
    local follow="${1:-false}"
    local project_dir="${2:-.}"

    ensure_railway || return 1

    # Change to project directory if specified
    if [ "$project_dir" != "." ]; then
        if [ ! -d "$project_dir" ]; then
            log_error "Project directory not found: $project_dir"
            return 1
        fi
        cd "$project_dir" || return 1
    fi

    # Check authentication
    if ! railway_is_authenticated; then
        log_error "Not authenticated with Railway. Run 'railway login' first."
        return 1
    fi

    if [ "$follow" = "true" ] || [ "$follow" = "--follow" ] || [ "$follow" = "-f" ]; then
        railway logs --follow
    else
        railway logs
    fi

    return $?
}

# ==========================================
# Railway Environment Variables
# ==========================================

railway_env() {
    local action="${1:-list}"
    shift 2>/dev/null || true

    ensure_railway || return 1

    # Check authentication
    if ! railway_is_authenticated; then
        log_error "Not authenticated with Railway. Run 'railway login' first."
        return 1
    fi

    case "$action" in
        list|ls|"")
            railway variables
            ;;
        set|add)
            if [ $# -eq 0 ]; then
                log_error "Usage: railway_env set KEY=value [KEY2=value2 ...]"
                return 1
            fi
            for var in "$@"; do
                railway variables set "$var"
            done
            ;;
        unset|rm|remove|delete)
            if [ $# -eq 0 ]; then
                log_error "Usage: railway_env unset KEY [KEY2 ...]"
                return 1
            fi
            for key in "$@"; do
                railway variables unset "$key"
            done
            ;;
        get)
            if [ -z "$1" ]; then
                log_error "Usage: railway_env get KEY"
                return 1
            fi
            railway variables | grep "^$1=" | cut -d'=' -f2-
            ;;
        *)
            log_error "Unknown action: $action"
            echo "Usage: railway_env [list|set|unset|get] [args...]"
            return 1
            ;;
    esac

    return $?
}

# ==========================================
# Railway Init
# ==========================================

railway_init() {
    local project_name="${1:-}"
    local project_dir="${2:-.}"

    ensure_railway || return 1

    # Change to project directory if specified
    if [ "$project_dir" != "." ]; then
        if [ ! -d "$project_dir" ]; then
            log_error "Project directory not found: $project_dir"
            return 1
        fi
        cd "$project_dir" || return 1
    fi

    # Check authentication
    if ! railway_is_authenticated; then
        log_error "Not authenticated with Railway. Run 'railway login' first."
        return 1
    fi

    log "Initializing Railway project..."

    if [ -n "$project_name" ]; then
        railway init --name "$project_name"
    else
        railway init
    fi

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        log "Railway project initialized successfully"
    else
        log_error "Failed to initialize Railway project"
    fi

    return $exit_code
}

# ==========================================
# Railway Project Info
# ==========================================

railway_get_project_url() {
    ensure_railway || return 1

    if ! railway_is_authenticated; then
        return 1
    fi

    railway domain 2>/dev/null | head -1
}

railway_open() {
    ensure_railway || return 1

    if ! railway_is_authenticated; then
        log_error "Not authenticated with Railway. Run 'railway login' first."
        return 1
    fi

    railway open
}

# ==========================================
# Railway Service Management
# ==========================================

railway_list_projects() {
    ensure_railway || return 1

    if ! railway_is_authenticated; then
        log_error "Not authenticated with Railway. Run 'railway login' first."
        return 1
    fi

    railway list
}

railway_whoami() {
    ensure_railway || return 1
    railway whoami
}
