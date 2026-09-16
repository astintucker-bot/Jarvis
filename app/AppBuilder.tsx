"use client";
import { FormEvent, useMemo, useState } from "react";

type ProjectFile = { path: string; content: string };
type Project = { name: string; summary: string; stack: string[]; setup: string[]; files: ProjectFile[] };

export function AppBuilder() {
  const [idea, setIdea] = useState("");
  const [stack, setStack] = useState("Next.js, TypeScript, responsive web app");
  const [project, setProject] = useState<Project | null>(null);
  const [activePath, setActivePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeFile = useMemo(() => project?.files.find(file => file.path === activePath) || project?.files[0], [activePath, project]);

  async function build(event: FormEvent) {
    event.preventDefault(); if (loading) return;
    setLoading(true); setError(""); setProject(null);
    try {
      const response = await fetch("/api/build-app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea, stack }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Build failed.");
      setProject(data.project); setActivePath(data.project.files[0]?.path || "");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to build the app."); }
    finally { setLoading(false); }
  }

  function downloadProject() {
    if (!project) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url;
    link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "app"}-project.json`;
    link.click(); URL.revokeObjectURL(url);
  }

  return <section className="builder-shell">
    <form className="builder-form" onSubmit={build}>
      <small>AI SOFTWARE STUDIO</small><h2>APP BUILDER</h2>
      <label htmlFor="app-idea">DESCRIBE THE APP</label>
      <textarea id="app-idea" value={idea} onChange={event => setIdea(event.target.value)} minLength={10} required placeholder="Build a quality audit app that tracks findings, owners, due dates, photos, and corrective actions." />
      <label htmlFor="app-stack">PREFERRED TECHNOLOGY</label>
      <input id="app-stack" value={stack} onChange={event => setStack(event.target.value)} />
      <button disabled={loading}>{loading ? "DESIGNING & CODING…" : "BUILD APPLICATION"}</button>
      <p>Jarvis generates source code. Review and test it before deployment.</p>
      {error && <strong className="builder-error">{error}</strong>}
    </form>
    {project ? <section className="builder-results">
      <article className="project-overview"><small>GENERATED PROJECT</small><h2>{project.name}</h2><p>{project.summary}</p><button onClick={downloadProject}>DOWNLOAD PROJECT JSON</button><div className="stack-list">{project.stack.map(item => <span key={item}>{item}</span>)}</div><ol>{project.setup.map((step, index) => <li key={index}>{step}</li>)}</ol></article>
      <article className="code-browser"><nav>{project.files.map(file => <button key={file.path} className={activeFile?.path === file.path ? "selected" : ""} onClick={() => setActivePath(file.path)}>{file.path}</button>)}</nav><div><header><strong>{activeFile?.path}</strong><button onClick={() => activeFile && navigator.clipboard.writeText(activeFile.content)}>COPY FILE</button></header><pre><code>{activeFile?.content}</code></pre></div></article>
    </section> : <section className="builder-empty"><i /><h2>READY TO BUILD</h2><p>Describe your product and Jarvis will generate its architecture, source files, and setup plan.</p></section>}
  </section>;
}
