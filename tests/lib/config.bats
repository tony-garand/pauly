#!/usr/bin/env bats

# Tests for lib/config.sh

load '../test_helper/common'

setup() {
    setup_test_env
    source "$PAULY_DIR/lib/config.sh"
}

teardown() {
    teardown_test_env
}

@test "config_exists returns false when no config file" {
    run config_exists
    assert_failure
}

@test "config_exists returns true when config file exists" {
    create_mock_config
    run config_exists
    assert_success
}

@test "load_config sets default values when no config file" {
    load_config
    [[ "$EMAIL" == "" ]]
    [[ "$PROJECTS_DIR" == "$HOME/Projects" ]]
    [[ "$MAX_LOG_SIZE_MB" == "10" ]]
}

@test "load_config loads values from config file" {
    create_mock_config "user@example.com" "$TEST_TEMP_DIR/MyProjects"
    load_config
    [[ "$EMAIL" == "user@example.com" ]]
    [[ "$PROJECTS_DIR" == "$TEST_TEMP_DIR/MyProjects" ]]
}

@test "save_config creates config file" {
    EMAIL="save-test@example.com"
    PROJECTS_DIR="$TEST_TEMP_DIR/SavedProjects"
    MAX_LOG_SIZE_MB=20

    save_config

    assert_file_exists "$CONFIG_FILE"
    source "$CONFIG_FILE"
    [[ "$EMAIL" == "save-test@example.com" ]]
}

@test "save_config sets correct permissions" {
    EMAIL="test@example.com"
    save_config

    local perms=$(stat -f "%Lp" "$CONFIG_FILE" 2>/dev/null || stat -c "%a" "$CONFIG_FILE" 2>/dev/null)
    [[ "$perms" == "600" ]]
}

@test "get_config_value returns correct value" {
    create_mock_config "get-test@example.com"
    run get_config_value "EMAIL"
    assert_success
    [[ "$output" == "get-test@example.com" ]]
}

@test "smtp_configured returns false when not configured" {
    SMTP_USER=""
    SMTP_PASSWORD=""
    run smtp_configured
    assert_failure
}

@test "smtp_configured returns true when configured" {
    SMTP_USER="user@example.com"
    SMTP_PASSWORD="password123"
    run smtp_configured
    assert_success
}

@test "ensure_config_dir creates config directory" {
    rmdir "$CONFIG_DIR" 2>/dev/null || true
    ensure_config_dir
    assert_dir_exists "$CONFIG_DIR"
}
