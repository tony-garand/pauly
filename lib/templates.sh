#!/bin/bash

# Template system for Pauly project scaffolding

TEMPLATES_DIR="${SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}/templates"

# List available templates
list_templates() {
    echo "Available templates:"
    echo ""
    for template_dir in "$TEMPLATES_DIR"/*/; do
        if [ -d "$template_dir" ] && [ -f "$template_dir/template.json" ]; then
            local name=$(basename "$template_dir")
            local desc=$(jq -r '.description // "No description"' "$template_dir/template.json" 2>/dev/null)
            echo "  $name - $desc"
        fi
    done
    echo ""
    echo "Usage: pauly dev init --template <name> <idea.md>"
}

# Get template metadata
get_template_info() {
    local template_name="$1"
    local template_path="$TEMPLATES_DIR/$template_name"

    if [ ! -d "$template_path" ] || [ ! -f "$template_path/template.json" ]; then
        echo "Template not found: $template_name" >&2
        return 1
    fi

    cat "$template_path/template.json"
}

# Render a template file with variable substitution
render_template_file() {
    local template_file="$1"
    local dest_file="$2"
    shift 2

    # Build sed replacement commands from key=value pairs
    local sed_args=()
    for kv in "$@"; do
        local key="${kv%%=*}"
        local value="${kv#*=}"
        # Escape special characters for sed
        value=$(echo "$value" | sed 's/[&/\]/\\&/g')
        sed_args+=(-e "s|{{${key}}}|${value}|g")
    done

    # Apply substitutions
    if [ ${#sed_args[@]} -gt 0 ]; then
        sed "${sed_args[@]}" "$template_file" > "$dest_file"
    else
        cp "$template_file" "$dest_file"
    fi
}

# Initialize project from template
init_from_template() {
    local template_name="$1"
    local project_dir="$2"
    local project_name="$3"
    shift 3
    local extra_vars=("$@")

    local template_path="$TEMPLATES_DIR/$template_name"

    if [ ! -d "$template_path" ]; then
        echo "Template not found: $template_name" >&2
        list_templates
        return 1
    fi

    # Read template metadata
    local template_json="$template_path/template.json"
    if [ ! -f "$template_json" ]; then
        echo "Invalid template: missing template.json" >&2
        return 1
    fi

    echo "Initializing project from template: $template_name"
    echo "Project directory: $project_dir"
    echo ""

    # Create project directory
    mkdir -p "$project_dir"

    # Default variables
    local vars=(
        "PROJECT_NAME=$project_name"
        "PROJECT_DIR=$project_dir"
        "YEAR=$(date +%Y)"
        "DATE=$(date +%Y-%m-%d)"
    )

    # Add extra variables
    vars+=("${extra_vars[@]}")

    # Copy and render files from files/ directory
    local files_dir="$template_path/files"
    if [ -d "$files_dir" ]; then
        echo "Copying template files..."

        find "$files_dir" -type f | while read -r src_file; do
            # Get relative path from files/
            local rel_path="${src_file#$files_dir/}"
            local dest_file="$project_dir/$rel_path"

            # Create parent directory
            mkdir -p "$(dirname "$dest_file")"

            # Render template
            render_template_file "$src_file" "$dest_file" "${vars[@]}"
            echo "  Created: $rel_path"
        done
    fi

    # Process .template files in template root
    for template_file in "$template_path"/*.template; do
        if [ -f "$template_file" ]; then
            local base_name=$(basename "$template_file" .template)
            local dest_file="$project_dir/$base_name"
            render_template_file "$template_file" "$dest_file" "${vars[@]}"
            echo "  Created: $base_name"
        fi
    done

    # Run post-init script if exists
    local post_init="$template_path/post-init.sh"
    if [ -f "$post_init" ] && [ -x "$post_init" ]; then
        echo ""
        echo "Running post-init script..."
        (cd "$project_dir" && bash "$post_init" "$project_name" "${vars[@]}")
    fi

    # Show next steps from template
    local next_steps=$(jq -r '.nextSteps // empty' "$template_json" 2>/dev/null)
    if [ -n "$next_steps" ]; then
        echo ""
        echo "Next steps:"
        echo "$next_steps" | jq -r '.[]' 2>/dev/null | while read -r step; do
            echo "  - $step"
        done
    fi

    echo ""
    echo "Project initialized successfully!"
}

# Validate template structure
validate_template() {
    local template_name="$1"
    local template_path="$TEMPLATES_DIR/$template_name"

    if [ ! -d "$template_path" ]; then
        echo "Template directory not found: $template_path"
        return 1
    fi

    if [ ! -f "$template_path/template.json" ]; then
        echo "Missing template.json"
        return 1
    fi

    # Validate JSON
    if ! jq empty "$template_path/template.json" 2>/dev/null; then
        echo "Invalid template.json (not valid JSON)"
        return 1
    fi

    # Check required fields
    local name=$(jq -r '.name // empty' "$template_path/template.json")
    if [ -z "$name" ]; then
        echo "template.json missing 'name' field"
        return 1
    fi

    echo "Template '$template_name' is valid"
    return 0
}
