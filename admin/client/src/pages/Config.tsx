import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { ErrorDisplay } from "@/components/ui/error";
import {
  Settings,
  Pencil,
  Check,
  X,
  Trash2,
  Plus,
} from "lucide-react";
import {
  fetchPaulyConfig,
  updatePaulyConfig,
  deletePaulyConfig,
} from "@/lib/api";

export function Config() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const configRes = await fetchPaulyConfig();
      setConfig(configRes.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  const handleSave = async (key: string) => {
    try {
      await updatePaulyConfig(key, editValue);
      setConfig((prev) => ({ ...prev, [key]: editValue }));
      setEditingKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await deletePaulyConfig(key);
      setConfig((prev) => {
        const newConfig = { ...prev };
        delete newConfig[key];
        return newConfig;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    try {
      await updatePaulyConfig(newKey.trim(), newValue);
      setConfig((prev) => ({ ...prev, [newKey.trim()]: newValue }));
      setNewKey("");
      setNewValue("");
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  };

  if (loading) {
    return <Loading message="Loading configuration..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuration</h1>
        <p className="text-muted-foreground">
          Manage Pauly settings (~/.config/pauly/config)
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Settings
              </CardTitle>
              <CardDescription>
                Edit configuration values directly
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Add new config form */}
          {showAddForm && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
              <Input
                placeholder="KEY_NAME"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                className="w-48 font-mono text-sm"
              />
              <Input
                placeholder="value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="flex-1 font-mono text-sm"
              />
              <Button size="sm" onClick={handleAdd} disabled={!newKey.trim()}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddForm(false);
                  setNewKey("");
                  setNewValue("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {Object.keys(config).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(config).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-4 py-2 border-b last:border-0"
                >
                  <code className="text-sm font-medium min-w-[200px]">
                    {key}
                  </code>
                  {editingKey === key ? (
                    <>
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 font-mono text-sm"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSave(key)}
                      >
                        <Check className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingKey(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <code className="text-sm text-muted-foreground break-all flex-1">
                        {value}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(key, value)}
                        className="h-7 w-7 p-0"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(key)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No configuration found. Click Add to create one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
