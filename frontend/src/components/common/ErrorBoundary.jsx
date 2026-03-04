import { Component } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';
import GlassCard from './GlassCard';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Log to error reporting service in production
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 gradient-overlay">
          <GlassCard className="max-w-lg w-full text-center" padding="xl">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            
            <h1 className="text-xl font-bold text-daikin-dark mb-2">
              Something went wrong
            </h1>
            
            <p className="text-surface-500 mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>

            {this.props.showDetails && this.state.error && (
              <div className="mb-6 p-4 bg-surface-100 rounded-lg text-left">
                <p className="text-xs font-mono text-red-600 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                variant="secondary"
                onClick={this.handleReset}
              >
                Try Again
              </Button>
              <Button
                variant="primary"
                onClick={this.handleReload}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Reload Page
              </Button>
            </div>
          </GlassCard>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;