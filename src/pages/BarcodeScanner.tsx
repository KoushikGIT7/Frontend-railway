import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, AlertCircle, CheckCircle } from 'lucide-react';

interface BarcodeResult {
  ok: boolean;
  batchId?: string;
  qrData?: any;
  viewerUrl?: string;
  error?: string;
}

const BarcodeScanner: React.FC = () => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [result, setResult] = useState<BarcodeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleBarcodeLookup = async (barcodeCode: string) => {
    if (!barcodeCode.trim()) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch(`/api/lookupBarcode/${encodeURIComponent(barcodeCode)}`);
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Barcode lookup error:', error);
      setResult({
        ok: false,
        error: 'Failed to lookup barcode. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleBarcodeLookup(barcodeInput);
  };

  const handleGoToViewer = () => {
    if (result?.viewerUrl) {
      window.open(result.viewerUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md mx-auto p-6">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Barcode Scanner</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Enter or scan a barcode to lookup batch information</p>
          </div>
        </div>

        {/* Barcode Input Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Barcode Code
              </label>
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Enter barcode code (e.g., B123456789)"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !barcodeInput.trim()}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Looking up...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Lookup Barcode</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            {result.ok ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Batch Found!</span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Batch ID:</span>
                    <span className="ml-2 font-mono text-gray-900 dark:text-white">{result.batchId}</span>
                  </div>
                  
                  {result.qrData && (
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Product:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{result.qrData.productName}</span>
                    </div>
                  )}
                  
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Category:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{result.qrData?.category}</span>
                  </div>
                </div>

                <button
                  onClick={handleGoToViewer}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  View Full Batch Details
                </button>
                
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <strong>Barcode Scanned Successfully!</strong><br/>
                    The barcode "{barcodeInput}" was found and linked to batch {result.batchId}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <span className="font-medium">Barcode Not Found</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {result.error || 'The scanned barcode does not match any batch in our system.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">How to use:</h3>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Scan a barcode with your phone's camera</li>
            <li>• Or manually enter the barcode code (e.g., "B12345678")</li>
            <li>• The system will lookup the batch information</li>
            <li>• Click "View Full Batch Details" to see complete information</li>
          </ul>
          
          <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              <strong>Note:</strong> Barcodes contain short codes (like "B12345678") that link to batch details. 
              QR codes contain full URLs for direct access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
