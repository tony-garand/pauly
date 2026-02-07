#!/bin/bash

# Common test utilities for Pauly bats tests

# Get the directory where this helper lives
TEST_HELPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$(dirname "$TEST_HELPER_DIR")"
PAULY_DIR="$(dirname "$TESTS_DIR")"

# Fixtures directory
FIXTURES_DIR="$TEST_HELPER_DIR/fixtures"

# Temp directory for test isolation
export TEST_TEMP_DIR=""

# Setup function to call at start of each test
setup_test_env() {
    TEST_TEMP_DIR="$(mktemp -d)"
    export HOME="$TEST_TEMP_DIR"
    export CONFIG_DIR="$TEST_TEMP_DIR/.config/pauly"
    export CONFIG_FILE="$CONFIG_DIR/config"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$TEST_TEMP_DIR/.pauly/logs"
}

# Teardown function to call at end of each test
teardown_test_env() {
    if [[ -n "$TEST_TEMP_DIR" && -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

# Create a mock config file
create_mock_config() {
    local email="${1:-test@example.com}"
    local projects_dir="${2:-$TEST_TEMP_DIR/Projects}"

    mkdir -p "$CONFIG_DIR"
    mkdir -p "$projects_dir"

    cat > "$CONFIG_FILE" << EOF
EMAIL="$email"
PROJECTS_DIR="$projects_dir"
MAX_LOG_SIZE_MB=10
MAX_LOG_FILES=5
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="$email"
SMTP_PASSWORD="test-password"
GITHUB_TASKS_REPO=""
GITHUB_TASKS_LABEL="pauly"
AUTOFIX_ENABLED="false"
EOF
}

# Create a mock project directory
create_mock_project() {
    local name="$1"
    local projects_dir="${2:-$TEST_TEMP_DIR/Projects}"

    local project_dir="$projects_dir/$name"
    mkdir -p "$project_dir"

    # Initialize git repo
    (
        cd "$project_dir"
        git init -q
        git config user.email "test@example.com"
        git config user.name "Test User"
    )

    echo "$project_dir"
}

# Create a mock TASKS.md file
create_mock_tasks() {
    local project_dir="$1"
    shift
    local tasks=("$@")

    cat > "$project_dir/TASKS.md" << 'EOF'
# Tasks

EOF

    for task in "${tasks[@]}"; do
        echo "- [ ] $task" >> "$project_dir/TASKS.md"
    done
}

# Create a mock CONTEXT.md file
create_mock_context() {
    local project_dir="$1"
    local content="${2:-# Test Context}"

    echo "$content" > "$project_dir/CONTEXT.md"
}

# Assert that a file exists
assert_file_exists() {
    local file="$1"
    [[ -f "$file" ]] || {
        echo "Expected file to exist: $file"
        return 1
    }
}

# Assert that a file does not exist
assert_file_not_exists() {
    local file="$1"
    [[ ! -f "$file" ]] || {
        echo "Expected file to not exist: $file"
        return 1
    }
}

# Assert that a directory exists
assert_dir_exists() {
    local dir="$1"
    [[ -d "$dir" ]] || {
        echo "Expected directory to exist: $dir"
        return 1
    }
}

# Assert that output contains a string
assert_output_contains() {
    local expected="$1"
    [[ "$output" == *"$expected"* ]] || {
        echo "Expected output to contain: $expected"
        echo "Actual output: $output"
        return 1
    }
}

# Assert that output does not contain a string
assert_output_not_contains() {
    local unexpected="$1"
    [[ "$output" != *"$unexpected"* ]] || {
        echo "Expected output to not contain: $unexpected"
        echo "Actual output: $output"
        return 1
    }
}

# Assert exit code is 0
assert_success() {
    [[ "$status" -eq 0 ]] || {
        echo "Expected exit code 0, got $status"
        echo "Output: $output"
        return 1
    }
}

# Assert exit code is non-zero
assert_failure() {
    [[ "$status" -ne 0 ]] || {
        echo "Expected non-zero exit code, got $status"
        return 1
    }
}

# Mock a command
mock_command() {
    local name="$1"
    local output="${2:-}"
    local exit_code="${3:-0}"

    local mock_dir="$TEST_TEMP_DIR/mocks"
    mkdir -p "$mock_dir"

    cat > "$mock_dir/$name" << EOF
#!/bin/bash
echo "$output"
exit $exit_code
EOF
    chmod +x "$mock_dir/$name"

    export PATH="$mock_dir:$PATH"
}
