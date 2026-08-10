import { Button,Card } from '@/components/ui/primitives';
import { AlertCircle,RefreshCw } from 'lucide-react';
import { Component,ErrorInfo,ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private isStaleChunkError = () => {
    const message = this.state.error?.message || '';
    return /dynamically imported module|loading chunk|chunkloaderror|importing a module script/i.test(message);
  };

  private handleReset = async () => {
    if (this.isStaleChunkError()) {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.filter((name) => name.startsWith('hubvault-cache-')).map((name) => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      }
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      const staleChunk = this.isStaleChunkError();
      return (
        <div className="p-6 max-w-lg mx-auto my-12">
          <Card className="p-6 text-center space-y-4 border border-rose-500/20 bg-rose-500/5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {this.props.fallbackTitle || 'Something went wrong'}
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {staleChunk
                  ? 'A newer HubVault version is available. Reload to update this page.'
                  : this.state.error?.message || 'An unexpected runtime error occurred.'}
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={this.handleReset}
                className="min-h-[44px]"
              >
                {staleChunk ? 'Reload Latest Version' : 'Try Again'}
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
