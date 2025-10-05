import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { QrCode, Factory, CheckCircle, Hash, MapPin, Calendar, Package, ArrowLeft, Download, Share2 } from 'lucide-react';

interface BatchDetails {
  basicInfo: {
    batchNumber: string;
    productName: string;
    category: string;
    manufacturingDate: string;
    expiryDate: string;
    batchSize: number;
    manufacturer: string;
    location: string;
  };
  qualityControl: {
    grade: string;
    testResults: string;
    inspector: string;
    certificationNumber: string;
    testDate: string;
    compliance: string;
  };
  specifications: {
    material: string;
    tensileStrength: string;
    yieldStrength: string;
    elongation: string;
    hardness: string;
    chemicalComposition: string;
  };
  supplyChain: {
    rawMaterialSource: string;
    transportMode: string;
    deliveryDate: string;
    destinationDivision: string;
    trackingNumber: string;
    handledBy: string;
  };
  approval: {
    approvedBy: string;
    approvalDate: string;
    approvalNumber: string;
    digitalSignature: string;
    blockchainHash: string;
    qrGeneratedAt: string;
  };
  installation: {
    plannedInstallation: string;
    installationTeam: string;
    estimatedInstallDate: string;
    maintenanceSchedule: string;
    warrantyPeriod: string;
    replacementCycle: string;
  };
}

interface QRData {
  batchId: string;
  productId: string;
  manufacturerId: string;
  approvalDate: string;
  uniqueCode: string;
  productName: string;
  category: string;
  batchDetails?: BatchDetails;
}

const QRViewer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { batchId: urlBatchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQRData = () => {
      console.log('🔍 QRViewer: Loading QR data...', { urlBatchId, searchParams: Object.fromEntries(searchParams) });
      try {
        // 1) Prefer embedded data (fast path, zero network)
        const dataParam = searchParams.get('data');
        if (dataParam) {
          console.log('📦 QRViewer: Found embedded data');
          const decodedData = JSON.parse(decodeURIComponent(dataParam));
          setQrData(decodedData);
          setLoading(false);
          // opportunistically cache by batchId if available
          if (decodedData?.batchId) {
            try { sessionStorage.setItem(`qr:${decodedData.batchId}`, JSON.stringify(decodedData)); } catch {}
          }
          return;
        }

        // 2) BatchId route: serve instantly from cache if present, then refresh in background
        const batchParam = searchParams.get('batch');
        const batchId = urlBatchId || batchParam || '';
        console.log('🆔 QRViewer: Batch ID found:', batchId);
        if (batchId) {
          const cacheKey = `qr:${batchId}`;
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              setQrData(parsed);
              setLoading(false);
            } catch {}
          }
          // Background refresh to keep snappy UX
          fetchBatchData(batchId);
          if (!cached) return; // keep spinner only until first paint
          return; // already painted with cache
        }

        setError('No batch data found. Please scan a valid QR code.');
        setLoading(false);
      } catch (err) {
        console.error('Error loading QR data:', err);
        setError('Invalid QR code data. Please scan a valid QR code.');
        setLoading(false);
      }
    };

    loadQRData();
  }, [searchParams, urlBatchId]);

  const fetchBatchData = async (batchId: string) => {
    console.log('🌐 QRViewer: Fetching batch data for:', batchId);
    const tryFetch = async (base: string, timeoutMs = 2000) => {
      console.log('📡 QRViewer: Trying fetch from:', base);
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(`${base}/getQRCode/${batchId}`, { signal: ctrl.signal });
        clearTimeout(id);
        console.log('📡 QRViewer: Fetch response:', res.status, res.ok);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        console.log('📡 QRViewer: Fetch success:', json);
        return json;
      } catch (e) {
        clearTimeout(id);
        console.log('📡 QRViewer: Fetch error:', e);
        throw e;
      }
    };

    try {
      // Prefer explicit API base (for production like Railway), else fallback to same-origin API proxy, else origin
      const envApi = (import.meta as any).env?.VITE_API_URL as string | undefined;
      const primary = envApi || `${window.location.origin}`;
      console.log('🌐 QRViewer: Using API base:', primary);
      
      // Try same-origin proxy first (zero CORS issues), then fallback to LAN API
      let result: any;
      try {
        console.log('📡 QRViewer: Trying proxy first...');
        result = await tryFetch('/api', 1500);
      } catch (proxyError) {
        console.log('📡 QRViewer: Proxy failed, trying direct API...', proxyError);
        try {
          result = await tryFetch(primary, 1800);
        } catch (e) {
          console.error('All fetch attempts failed', e);
          setError('Unable to load batch data. Ensure the phone is on the same WiFi and the API (8788) is reachable.');
          setLoading(false);
          return;
        }
      }

      if (result?.ok && result.qrData) {
        setQrData(result.qrData);
        try { sessionStorage.setItem(`qr:${batchId}`, JSON.stringify(result.qrData)); } catch {}
      } else {
        setError('Batch not found. This QR code may be invalid or expired.');
      }
    } finally {
      setLoading(false);
    }
  };

  const shareQR = async () => {
    if (qrData) {
      const shareData = {
        title: `Rail Product - ${qrData.productName}`,
        text: `Batch: ${qrData.batchId} - ${qrData.productName}`,
        url: window.location.href
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          console.log('Error sharing:', err);
        }
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <QrCode className="h-16 w-16 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-gray-700">Loading batch details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <QrCode className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-800 mb-2">Invalid QR Code</h1>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (!qrData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <QrCode className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-yellow-800 mb-2">No Data Found</h1>
          <p className="text-yellow-700 mb-4">Unable to load batch details. Please check your connection and try again.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-blue-900 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <QrCode className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">भारतीय रेल - Indian Railways</h1>
              <p className="text-blue-200 text-sm">Product Verification System</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={shareQR}
              className="p-2 bg-blue-800 hover:bg-blue-700 rounded-lg transition-colors"
              title="Share QR"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/')}
              className="p-2 bg-blue-800 hover:bg-blue-700 rounded-lg transition-colors"
              title="Back to Home"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Product Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center space-x-4 mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Package className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{qrData.productName}</h2>
              <p className="text-gray-600">{qrData.category}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Batch ID</p>
              <p className="text-lg font-mono text-gray-900">{qrData.batchId}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Unique Code</p>
              <p className="text-lg font-mono text-gray-900">{qrData.uniqueCode}</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">Verified & Approved</span>
            </div>
            <span className="text-sm text-green-700">{new Date(qrData.approvalDate).toLocaleDateString()}</span>
          </div>
        </div>

        {qrData.batchDetails && (
          <>
            {/* Basic Information */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-blue-600 text-white p-4">
                <div className="flex items-center space-x-2">
                  <Factory className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Product Name</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.basicInfo.productName}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Batch Size</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.basicInfo.batchSize} units</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Manufacturing Date</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.basicInfo.manufacturingDate}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Manufacturer</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.basicInfo.manufacturer}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Location</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.basicInfo.location}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Expiry Date</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.basicInfo.expiryDate}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Control */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-green-600 text-white p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Quality Control</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Grade</p>
                      <p className="text-lg font-bold text-green-600">{qrData.batchDetails.qualityControl.grade}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Test Results</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.qualityControl.testResults}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Inspector</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.qualityControl.inspector}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Certification Number</p>
                      <p className="text-lg font-mono text-gray-900">{qrData.batchDetails.qualityControl.certificationNumber}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Test Date</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.qualityControl.testDate}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Compliance</p>
                      <p className="text-sm text-gray-900">{qrData.batchDetails.qualityControl.compliance}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-purple-600 text-white p-4">
                <div className="flex items-center space-x-2">
                  <Hash className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Technical Specifications</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Material</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.specifications.material}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Tensile Strength</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.specifications.tensileStrength}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Yield Strength</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.specifications.yieldStrength}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Elongation</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.specifications.elongation}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Hardness</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.specifications.hardness}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Chemical Composition</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.specifications.chemicalComposition}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Supply Chain */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-orange-600 text-white p-4">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Supply Chain Information</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Raw Material Source</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.supplyChain.rawMaterialSource}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Transport Mode</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.supplyChain.transportMode}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Delivery Date</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.supplyChain.deliveryDate}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Destination Division</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.supplyChain.destinationDivision}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Tracking Number</p>
                      <p className="text-lg font-mono text-gray-900">{qrData.batchDetails.supplyChain.trackingNumber}</p>
                    </div>
                    <div className="border-b border-gray-200 pb-2">
                      <p className="text-sm font-medium text-gray-600">Handled By</p>
                      <p className="text-lg text-gray-900">{qrData.batchDetails.supplyChain.handledBy}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Approval & Installation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Approval */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-green-600 text-white p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Approval</h3>
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  <div className="border-b border-gray-200 pb-2">
                    <p className="text-sm font-medium text-gray-600">Approved By</p>
                    <p className="text-lg text-gray-900">{qrData.batchDetails.approval.approvedBy}</p>
                  </div>
                  <div className="border-b border-gray-200 pb-2">
                    <p className="text-sm font-medium text-gray-600">Approval Number</p>
                    <p className="text-lg font-mono text-gray-900">{qrData.batchDetails.approval.approvalNumber}</p>
                  </div>
                  <div className="border-b border-gray-200 pb-2">
                    <p className="text-sm font-medium text-gray-600">Digital Signature</p>
                    <p className="text-lg text-green-600 font-medium">{qrData.batchDetails.approval.digitalSignature}</p>
                  </div>
                </div>
              </div>

              {/* Installation */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-red-600 text-white p-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Installation</h3>
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  <div className="border-b border-gray-200 pb-2">
                    <p className="text-sm font-medium text-gray-600">Planned Installation</p>
                    <p className="text-lg text-gray-900">{qrData.batchDetails.installation.plannedInstallation}</p>
                  </div>
                  <div className="border-b border-gray-200 pb-2">
                    <p className="text-sm font-medium text-gray-600">Installation Team</p>
                    <p className="text-lg text-gray-900">{qrData.batchDetails.installation.installationTeam}</p>
                  </div>
                  <div className="border-b border-gray-200 pb-2">
                    <p className="text-sm font-medium text-gray-600">Warranty Period</p>
                    <p className="text-lg text-gray-900">{qrData.batchDetails.installation.warrantyPeriod}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="bg-white rounded-xl shadow-lg p-6 text-center border border-gray-200">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-gray-700">Verified by Indian Railways QR System</span>
          </div>
          <p className="text-sm text-gray-600">
            This product has been verified through the official Indian Railways supply chain system.
            Scan timestamp: {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRViewer;
