"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { AiAgent, AiAgentCreate } from "@/lib/types";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, EmptyState, TableSkeleton } from "@/components/page-states";
import { toast } from "sonner";
import { Bot, Mic, Play, Plus, RefreshCw, Volume2 } from "lucide-react";

export default function AiAgentsPage() {
  const state = useApi(() => api.listAiAgents(1, 50), []);
  const agents = state.data?.items ?? [];
  const loading = state.loading;
  const error = state.error;
  const fetchAgents = state.refresh;

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<AiAgentCreate>({
    name: "",
    language: "hi-IN",
    model: "llama-3.3-70b-versatile",
    system_prompt: "",
    disclosure: "I am an automated AI assistant calling from ABC Recovery regarding your account.",
  });

  // Voice upload modal
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AiAgent | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  // Voice preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState("Namaste, kya aap mujhe sun sakte hain?");
  const [previewAudio, setPreviewAudio] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    if (formData.system_prompt.length < 10) {
      toast.error("System prompt must be at least 10 characters");
      return;
    }
    if (formData.disclosure.length < 10) {
      toast.error("Mandatory disclosure must be at least 10 characters");
      return;
    }

    setSubmitting(true);
    try {
      await api.createAiAgent(formData);
      toast.success("AI Agent created successfully");
      setCreateOpen(false);
      setFormData({
        name: "",
        language: "hi-IN",
        model: "llama-3.3-70b-versatile",
        system_prompt: "",
        disclosure: "I am an automated AI assistant calling from ABC Recovery regarding your account.",
      });
      fetchAgents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoiceUpload = async () => {
    if (!activeAgent || !audioFile) {
      toast.error("Please select an audio file (.wav, .mp3)");
      return;
    }
    setUploadingVoice(true);
    try {
      await api.uploadVoiceProfile(activeAgent.id, audioFile);
      toast.success("Voice sample uploaded and attached to agent");
      setVoiceOpen(false);
      setAudioFile(null);
      fetchAgents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Voice upload failed");
    } finally {
      setUploadingVoice(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!activeAgent || !previewText.trim()) return;
    setGeneratingPreview(true);
    try {
      const res = await api.generateVoicePreview(activeAgent.id, previewText);
      setPreviewAudio(`data:audio/${res.format};base64,${res.audio_base64}`);
      toast.success("Voice preview generated!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate preview");
    } finally {
      setGeneratingPreview(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Calling Agents</h1>
          <p className="text-sm text-muted-foreground">
            Configure agent prompts, required AI disclosure, and cloned voice profiles.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchAgents()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create Agent
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAgents} />
      ) : agents.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-10 w-10 text-muted-foreground" />}
          title="No AI Agents configured"
          description="Create your first agent and upload a voice sample to enable autonomous recovery conversations."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Create Agent
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active Profiles ({agents.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Name</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Voice Profile</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        <span>{agent.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{agent.language}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{agent.model}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          agent.status === "READY"
                            ? "default"
                            : agent.status === "DRAFT"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {agent.voice_profile ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>{agent.voice_profile.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No voice attached</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveAgent(agent);
                          setVoiceOpen(true);
                        }}
                      >
                        <Mic className="h-3.5 w-3.5 mr-1" /> Voice
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveAgent(agent);
                          setPreviewAudio(null);
                          setPreviewOpen(true);
                        }}
                      >
                        <Play className="h-3.5 w-3.5 mr-1" /> Preview
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create Agent Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create AI Calling Agent</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div>
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Priya Sharma"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="language">Language</Label>
                <Select
                  value={formData.language}
                  onValueChange={(v) => setFormData({ ...formData, language: v })}
                >
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hi-IN">Hindi (hi-IN)</SelectItem>
                    <SelectItem value="en-IN">Indian English (en-IN)</SelectItem>
                    <SelectItem value="hinglish">Hinglish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Select
                  value={formData.model}
                  onValueChange={(v) => setFormData({ ...formData, model: v })}
                >
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llama-3.3-70b-versatile">Llama 3.3 70B</SelectItem>
                    <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="qwen-2.5-7b">Qwen 2.5 7B (Local)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="prompt">System Prompt</Label>
              <Textarea
                id="prompt"
                rows={3}
                value={formData.system_prompt}
                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                placeholder="Define agent personality, recovery approach, and negotiation bounds..."
                required
              />
            </div>
            <div>
              <Label htmlFor="disclosure">Mandatory AI Disclosure</Label>
              <Textarea
                id="disclosure"
                rows={2}
                value={formData.disclosure}
                onChange={(e) => setFormData({ ...formData, disclosure: e.target.value })}
                placeholder="Explicit statement identifying the caller as an AI agent..."
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Required by policy: The caller must explicitly identify itself as an automated AI system.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Save Agent"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Voice Profile Dialog */}
      <Dialog open={voiceOpen} onOpenChange={setVoiceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Voice Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Attach reference audio for <strong>{activeAgent?.name}</strong> to enable Chatterbox / IndicF5 voice cloning.
            </p>
            <div>
              <Label htmlFor="voice-file">Select Audio Sample (.wav, .mp3)</Label>
              <Input
                id="voice-file"
                type="file"
                accept=".wav,.mp3,.ogg,.m4a"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVoiceOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleVoiceUpload} disabled={uploadingVoice || !audioFile}>
                {uploadingVoice ? "Uploading..." : "Attach Voice"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Voice Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Voice Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="preview-text">Preview Utterance</Label>
              <Textarea
                id="preview-text"
                rows={2}
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              variant="secondary"
              onClick={handleGeneratePreview}
              disabled={generatingPreview}
            >
              {generatingPreview ? "Synthesizing Speech..." : "Synthesize Preview"}
            </Button>
            {previewAudio && (
              <div className="p-3 bg-muted rounded-md space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Audio Output:</p>
                <audio controls src={previewAudio} className="w-full h-10" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
