#!/bin/bash

# Queue operations for Pauly task queue
# Provides bash interface to SQLite-based task queue

QUEUE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/queue"
QUEUE_CLI="$QUEUE_DIR/queue.js"

# Check if queue is enabled in config
queue_enabled() {
    [[ "${QUEUE_ENABLED:-false}" == "true" ]]
}

# Ensure queue dependencies are installed
ensure_queue_deps() {
    if [[ ! -d "$QUEUE_DIR/node_modules" ]]; then
        log "Installing queue dependencies..."
        (cd "$QUEUE_DIR" && npm install --silent) || {
            log_error "Failed to install queue dependencies"
            return 1
        }
    fi
    return 0
}

# Run a queue command
run_queue_cmd() {
    ensure_queue_deps || return 1
    node "$QUEUE_CLI" "$@"
}

# Enqueue a new job
# Usage: queue_enqueue <task_type> [priority] [blocked_by_ids] [task_data_json]
queue_enqueue() {
    local task_type="$1"
    local priority="${2:-0}"
    local blocked_by="$3"
    local task_data="${4:-{}}"

    local args=("$task_type" "--priority=$priority")

    if [[ -n "$blocked_by" ]]; then
        args+=("--blocked-by=$blocked_by")
    fi

    if [[ -n "$task_data" && "$task_data" != "{}" ]]; then
        args+=("--data=$task_data")
    fi

    run_queue_cmd enqueue "${args[@]}"
}

# Dequeue next available job for a worker
# Usage: queue_dequeue <worker_id>
# Returns JSON with job data or {"job": null, "acquired": false}
queue_dequeue() {
    local worker_id="$1"
    run_queue_cmd dequeue "$worker_id"
}

# Acknowledge job completion (success)
# Usage: queue_ack <job_id> [duration_ms]
queue_ack() {
    local job_id="$1"
    local duration_ms="$2"

    if [[ -n "$duration_ms" ]]; then
        run_queue_cmd ack "$job_id" "--duration=$duration_ms"
    else
        run_queue_cmd ack "$job_id"
    fi
}

# Negative acknowledge (failure)
# Usage: queue_nack <job_id> <error_message> [retry=true|false] [duration_ms]
queue_nack() {
    local job_id="$1"
    local error_message="$2"
    local retry="${3:-false}"
    local duration_ms="$4"

    local args=("$job_id" "--error=$error_message")

    if [[ "$retry" == "true" ]]; then
        args+=("--retry=true")
    fi

    if [[ -n "$duration_ms" ]]; then
        args+=("--duration=$duration_ms")
    fi

    run_queue_cmd nack "${args[@]}"
}

# Get queue status
queue_status() {
    run_queue_cmd status
}

# Get a specific job
# Usage: queue_get <job_id>
queue_get() {
    local job_id="$1"
    run_queue_cmd get "$job_id"
}

# List jobs
# Usage: queue_list [status] [limit]
queue_list() {
    local status="$1"
    local limit="${2:-50}"

    local args=("--limit=$limit")
    if [[ -n "$status" ]]; then
        args+=("--status=$status")
    fi

    run_queue_cmd list "${args[@]}"
}

# Cleanup stale and old jobs
# Usage: queue_cleanup [stale_minutes] [older_than_days]
queue_cleanup() {
    local stale_minutes="${1:-60}"
    local older_than_days="${2:-30}"

    run_queue_cmd cleanup "--stale-minutes=$stale_minutes" "--older-than-days=$older_than_days"
}

# Parse job JSON to extract a field
# Usage: queue_parse_field <json> <field>
queue_parse_field() {
    local json="$1"
    local field="$2"
    echo "$json" | jq -r ".$field // empty"
}

# Check if dequeue was successful
# Usage: queue_acquired <dequeue_result>
queue_acquired() {
    local result="$1"
    [[ "$(echo "$result" | jq -r '.acquired // false')" == "true" ]]
}

# Get job ID from dequeue result
# Usage: queue_job_id <dequeue_result>
queue_job_id() {
    local result="$1"
    echo "$result" | jq -r '.job.id // empty'
}

# Get job task type from dequeue result
# Usage: queue_job_type <dequeue_result>
queue_job_type() {
    local result="$1"
    echo "$result" | jq -r '.job.task_type // empty'
}

# Get job task data from dequeue result
# Usage: queue_job_data <dequeue_result>
queue_job_data() {
    local result="$1"
    echo "$result" | jq -r '.job.task_data // "{}"'
}

# Generate a unique worker ID for this process
generate_worker_id() {
    echo "worker-$$-$(date +%s)"
}
