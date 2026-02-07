#!/usr/bin/env bats

# Tests for lib/common.sh

load '../test_helper/common'

setup() {
    setup_test_env
    # Source config first (common.sh depends on it)
    source "$PAULY_DIR/lib/config.sh"
    source "$PAULY_DIR/lib/common.sh"
}

teardown() {
    teardown_test_env
}

@test "log outputs timestamped message" {
    run log "Test message"
    assert_success
    assert_output_contains "Test message"
    # Check for timestamp format [YYYY-MM-DD HH:MM:SS]
    [[ "$output" =~ \[[0-9]{4}-[0-9]{2}-[0-9]{2}\ [0-9]{2}:[0-9]{2}:[0-9]{2}\] ]]
}

@test "log_error outputs to stderr" {
    run bash -c 'source "$PAULY_DIR/lib/config.sh"; source "$PAULY_DIR/lib/common.sh"; log_error "Error message" 2>&1'
    assert_output_contains "ERROR: Error message"
}

@test "ensure_homebrew passes when brew exists" {
    mock_command "brew" ""
    run ensure_homebrew
    assert_success
}

@test "ensure_homebrew fails when brew missing" {
    # Remove brew from PATH
    export PATH="$TEST_TEMP_DIR/empty:$PATH"
    run ensure_homebrew
    assert_failure
}

@test "check_cli finds command in PATH" {
    mock_command "test-cli" "test-cli v1.0.0"
    run check_cli "test-cli"
    assert_success
}

@test "check_cli finds command in provided paths" {
    mkdir -p "$TEST_TEMP_DIR/custom-bin"
    echo '#!/bin/bash' > "$TEST_TEMP_DIR/custom-bin/custom-cli"
    chmod +x "$TEST_TEMP_DIR/custom-bin/custom-cli"

    run check_cli "custom-cli" "$TEST_TEMP_DIR/custom-bin/custom-cli"
    assert_success
    assert_output_contains "$TEST_TEMP_DIR/custom-bin/custom-cli"
}

@test "check_cli fails when command not found" {
    run check_cli "nonexistent-command-xyz"
    assert_failure
}

@test "check_config_value returns true for set value" {
    create_mock_config "test@example.com"
    run check_config_value "EMAIL"
    assert_success
}

@test "check_config_value returns false for unset value" {
    create_mock_config ""
    run check_config_value "NONEXISTENT_KEY"
    assert_failure
}

@test "check_directory returns true for writable directory" {
    mkdir -p "$TEST_TEMP_DIR/test-dir"
    run check_directory "$TEST_TEMP_DIR/test-dir"
    assert_success
}

@test "check_directory returns false for nonexistent directory" {
    run check_directory "$TEST_TEMP_DIR/nonexistent-dir"
    assert_failure
}

@test "check_file returns true for readable file" {
    echo "content" > "$TEST_TEMP_DIR/test-file"
    run check_file "$TEST_TEMP_DIR/test-file"
    assert_success
}

@test "check_file returns false for nonexistent file" {
    run check_file "$TEST_TEMP_DIR/nonexistent-file"
    assert_failure
}

@test "LOG_DIR is set correctly" {
    [[ "$LOG_DIR" == "$PAULY_DIR/logs" ]]
}

@test "rotate_log handles empty log file" {
    local log_file="$TEST_TEMP_DIR/test.log"
    touch "$log_file"
    run rotate_log "$log_file"
    assert_success
}
