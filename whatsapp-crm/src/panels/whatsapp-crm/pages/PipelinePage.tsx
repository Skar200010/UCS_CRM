import { PipelineBoard } from '../components/pipeline/PipelineBoard';

export function PipelinePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pipeline</h1>
        <p className="text-muted-foreground">Track your deals and sales pipeline</p>
      </div>
      <PipelineBoard />
    </div>
  );
}
