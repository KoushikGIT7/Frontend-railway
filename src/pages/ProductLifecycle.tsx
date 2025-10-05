import React, { useState, useEffect } from 'react';
import { Package, Factory, Truck, Wrench, CheckCircle, Clock, AlertTriangle, MapPin, Hash, ExternalLink, Shield, Search, Filter, Download, Eye } from 'lucide-react';
import { apiGetProducts, apiMarkAsManufactured, apiMarkAsDelivered, apiMarkAsInstalled } from '../services/blockchainApi';
import clsx from 'clsx';

interface ProductLifecycleData {
  id: string;
  name: string;
  category: string;
  status: string;
  requestedBy: string;
  approvedBy: string;
  manufacturedBy: string;
  deliveredBy: string;
  installedBy: string;
  requestTime: string;
  approveTime: string;
  manufactureTime: string;
  deliverTime: string;
  installTime: string;
  manufacturingLocation: string;
  installationLocation: string;
  deliveryTrackingNumber: string;
  blockchainTxHash?: string;
  blockchainId?: string;
}

interface BlockchainAuditLog {
  id: string;
  timestamp: Date;
  action: string;
  productId: string;
  productName: string;
  txHash: string;
  blockNumber: string;
  status: 'success' | 'failed' | 'pending';
  details: string;
}

const ProductLifecycle: React.FC = () => {
  const [products, setProducts] = useState<ProductLifecycleData[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductLifecycleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<BlockchainAuditLog[]>([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditFilter, setAuditFilter] = useState<string>('all');

  useEffect(() => {
    loadProducts();
    generateMockAuditLogs();
  }, []);

  const generateMockAuditLogs = () => {
    const mockLogs: BlockchainAuditLog[] = [
      {
        id: '1',
        timestamp: new Date('2024-01-20T10:30:00'),
        action: 'PRODUCT_CREATED',
        productId: '1',
        productName: 'Test Wrench',
        txHash: '0x123abc456def789ghi012jkl345mno678pqr901stu234vwx567yza890bcd',
        blockNumber: '67605854',
        status: 'success',
        details: 'Product created and stored on blockchain'
      },
      {
        id: '2',
        timestamp: new Date('2024-01-20T10:35:00'),
        action: 'PRODUCT_APPROVED',
        productId: '1',
        productName: 'Test Wrench',
        txHash: '0x456def789abc123ghi456jkl789mno012pqr345stu678vwx901yza234bcd',
        blockNumber: '67605862',
        status: 'success',
        details: 'Product approved by DEN and QR code generated'
      },
      {
        id: '3',
        timestamp: new Date('2024-01-20T11:00:00'),
        action: 'PRODUCT_MANUFACTURED',
        productId: '1',
        productName: 'Test Wrench',
        txHash: '0x789abc123def456ghi789jkl012mno345pqr678stu901vwx234yza567bcd',
        blockNumber: '67605869',
        status: 'success',
        details: 'Product marked as manufactured with location details'
      },
      {
        id: '4',
        timestamp: new Date('2024-01-20T14:30:00'),
        action: 'PRODUCT_DELIVERED',
        productId: '1',
        productName: 'Test Wrench',
        txHash: '0x012jkl345mno678pqr901stu234vwx567yza890bcd123efg456hij789klm',
        blockNumber: '67605920',
        status: 'success',
        details: 'Product delivered with tracking number'
      },
      {
        id: '5',
        timestamp: new Date('2024-01-20T16:45:00'),
        action: 'PRODUCT_INSTALLED',
        productId: '1',
        productName: 'Test Wrench',
        txHash: '0x345mno678pqr901stu234vwx567yza890bcd123efg456hij789klm012nop',
        blockNumber: '67605980',
        status: 'success',
        details: 'Product installed at specified location'
      }
    ];
    setAuditLogs(mockLogs);
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await apiGetProducts();
      if (response.ok && response.products) {
        setProducts(response.products);
        if (response.products.length > 0) {
          setSelectedProduct(response.products[0]);
        }
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProductStatus = async (productId: string, status: 'manufactured' | 'delivered' | 'installed', additionalData: any) => {
    setUpdatingStatus(productId);
    try {
      let response;
      const id = parseInt(productId);
      
      switch (status) {
        case 'manufactured':
          response = await apiMarkAsManufactured({ id, manufacturingLocation: additionalData.location });
          break;
        case 'delivered':
          response = await apiMarkAsDelivered({ id, trackingNumber: additionalData.trackingNumber });
          break;
        case 'installed':
          response = await apiMarkAsInstalled({ id, installationLocation: additionalData.location });
          break;
      }

      if (response.ok) {
        alert(`✅ Product marked as ${status} successfully!\n\n🔗 Transaction Hash: ${response.txHash}`);
        await loadProducts(); // Refresh the list
      } else {
        alert(`❌ Failed to update status: ${response.error}`);
      }
    } catch (error) {
      console.error('Error updating product status:', error);
      alert('❌ Failed to update product status. Please try again.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'requested':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'manufactured':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'delivered':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'installed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'requested':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'manufactured':
        return <Factory className="h-4 w-4" />;
      case 'delivered':
        return <Truck className="h-4 w-4" />;
      case 'installed':
        return <Wrench className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus.toLowerCase()) {
      case 'approved':
        return 'manufactured';
      case 'manufactured':
        return 'delivered';
      case 'delivered':
        return 'installed';
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp || timestamp === '0') return 'Not set';
    return new Date(parseInt(timestamp) * 1000).toLocaleString();
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'PRODUCT_CREATED':
        return <Package className="h-4 w-4 text-blue-600" />;
      case 'PRODUCT_APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'PRODUCT_MANUFACTURED':
        return <Factory className="h-4 w-4 text-purple-600" />;
      case 'PRODUCT_DELIVERED':
        return <Truck className="h-4 w-4 text-orange-600" />;
      case 'PRODUCT_INSTALLED':
        return <Wrench className="h-4 w-4 text-emerald-600" />;
      default:
        return <Shield className="h-4 w-4 text-gray-600" />;
    }
  };

  const getAuditStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = log.productName.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
                         log.txHash.toLowerCase().includes(auditSearchTerm.toLowerCase());
    const matchesFilter = auditFilter === 'all' || log.status === auditFilter;
    return matchesSearch && matchesFilter;
  });

  const exportAuditLogs = () => {
    const csvContent = [
      ['Timestamp', 'Action', 'Product ID', 'Product Name', 'Transaction Hash', 'Block Number', 'Status', 'Details'],
      ...filteredAuditLogs.map(log => [
        log.timestamp.toISOString(),
        log.action,
        log.productId,
        log.productName,
        log.txHash,
        log.blockNumber,
        log.status,
        log.details
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blockchain_audit_logs.csv';
    a.click();
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Product Lifecycle Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Track and manage products through the complete manufacturing-delivery-installation lifecycle
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <button
              onClick={() => setShowAuditLogs(!showAuditLogs)}
              className={clsx(
                'px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2',
                showAuditLogs
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              )}
            >
              <Shield className="h-4 w-4" />
              <span>{showAuditLogs ? 'Hide' : 'Show'} Blockchain Audit</span>
            </button>
            <button
              onClick={loadProducts}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Package className="h-4 w-4" />
              <span>{loading ? 'Loading...' : 'Refresh Products'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Product List */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Products</h3>
              <button
                onClick={loadProducts}
                disabled={loading}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className={clsx(
                    'w-full text-left p-3 rounded-lg transition-colors',
                    selectedProduct?.id === product.id
                      ? 'bg-primary-100 dark:bg-primary-900 border border-primary-300 dark:border-primary-700'
                      : 'hover:bg-gray-50 dark:hover:bg-dark-700'
                  )}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    {getStatusIcon(product.status)}
                    <span className="font-medium text-gray-900 dark:text-white text-sm">{product.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">ID: {product.id}</p>
                  <span className={clsx(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1',
                    getStatusColor(product.status)
                  )}>
                    {product.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Lifecycle Details */}
        <div className="lg:col-span-3">
          {selectedProduct ? (
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedProduct.name}</h2>
                  <p className="text-gray-600 dark:text-gray-400">ID: {selectedProduct.id}</p>
                </div>
                <span className={clsx(
                  'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                  getStatusColor(selectedProduct.status)
                )}>
                  {getStatusIcon(selectedProduct.status)}
                  <span className="ml-2">{selectedProduct.status}</span>
                </span>
              </div>

              {/* Lifecycle Timeline */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Lifecycle Timeline</h3>
                <div className="space-y-4">
                  {/* Requested */}
                  <div className="flex items-center space-x-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <Clock className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">Requested</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        By: {selectedProduct.requestedBy} | {formatTimestamp(selectedProduct.requestTime)}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      ✓ Completed
                    </div>
                  </div>

                  {/* Approved */}
                  <div className="flex items-center space-x-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">Approved</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        By: {selectedProduct.approvedBy || 'DEN'} | {formatTimestamp(selectedProduct.approveTime)}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      ✓ Completed
                    </div>
                  </div>

                  {/* Manufactured */}
                  <div className={clsx(
                    'flex items-center space-x-4 p-4 rounded-lg',
                    selectedProduct.status.toLowerCase() === 'manufactured' || 
                    selectedProduct.status.toLowerCase() === 'delivered' || 
                    selectedProduct.status.toLowerCase() === 'installed'
                      ? 'bg-purple-50 dark:bg-purple-900/20'
                      : 'bg-gray-50 dark:bg-gray-900/20'
                  )}>
                    <div className="flex-shrink-0">
                      <div className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        selectedProduct.status.toLowerCase() === 'manufactured' || 
                        selectedProduct.status.toLowerCase() === 'delivered' || 
                        selectedProduct.status.toLowerCase() === 'installed'
                          ? 'bg-purple-600'
                          : 'bg-gray-400'
                      )}>
                        <Factory className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">Manufactured</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedProduct.manufacturedBy ? `By: ${selectedProduct.manufacturedBy}` : 'Pending'} | 
                        {selectedProduct.manufacturingLocation ? ` Location: ${selectedProduct.manufacturingLocation}` : ''} | 
                        {formatTimestamp(selectedProduct.manufactureTime)}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedProduct.status.toLowerCase() === 'manufactured' || 
                       selectedProduct.status.toLowerCase() === 'delivered' || 
                       selectedProduct.status.toLowerCase() === 'installed' ? '✓ Completed' : '⏳ Pending'}
                    </div>
                  </div>

                  {/* Delivered */}
                  <div className={clsx(
                    'flex items-center space-x-4 p-4 rounded-lg',
                    selectedProduct.status.toLowerCase() === 'delivered' || 
                    selectedProduct.status.toLowerCase() === 'installed'
                      ? 'bg-orange-50 dark:bg-orange-900/20'
                      : 'bg-gray-50 dark:bg-gray-900/20'
                  )}>
                    <div className="flex-shrink-0">
                      <div className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        selectedProduct.status.toLowerCase() === 'delivered' || 
                        selectedProduct.status.toLowerCase() === 'installed'
                          ? 'bg-orange-600'
                          : 'bg-gray-400'
                      )}>
                        <Truck className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">Delivered</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedProduct.deliveredBy ? `By: ${selectedProduct.deliveredBy}` : 'Pending'} | 
                        {selectedProduct.deliveryTrackingNumber ? ` Tracking: ${selectedProduct.deliveryTrackingNumber}` : ''} | 
                        {formatTimestamp(selectedProduct.deliverTime)}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedProduct.status.toLowerCase() === 'delivered' || 
                       selectedProduct.status.toLowerCase() === 'installed' ? '✓ Completed' : '⏳ Pending'}
                    </div>
                  </div>

                  {/* Installed */}
                  <div className={clsx(
                    'flex items-center space-x-4 p-4 rounded-lg',
                    selectedProduct.status.toLowerCase() === 'installed'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : 'bg-gray-50 dark:bg-gray-900/20'
                  )}>
                    <div className="flex-shrink-0">
                      <div className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        selectedProduct.status.toLowerCase() === 'installed'
                          ? 'bg-emerald-600'
                          : 'bg-gray-400'
                      )}>
                        <Wrench className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">Installed</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedProduct.installedBy ? `By: ${selectedProduct.installedBy}` : 'Pending'} | 
                        {selectedProduct.installationLocation ? ` Location: ${selectedProduct.installationLocation}` : ''} | 
                        {formatTimestamp(selectedProduct.installTime)}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedProduct.status.toLowerCase() === 'installed' ? '✓ Completed' : '⏳ Pending'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Update Actions */}
              {getNextStatus(selectedProduct.status) && (
                <div className="border-t border-gray-200 dark:border-dark-700 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Update Status to {getNextStatus(selectedProduct.status)?.toUpperCase()}
                  </h3>
                  
                  {getNextStatus(selectedProduct.status) === 'manufactured' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Manufacturing Location
                        </label>
                        <input
                          type="text"
                          id="manufacturingLocation"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                          placeholder="e.g., Mumbai Manufacturing Unit"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const location = (document.getElementById('manufacturingLocation') as HTMLInputElement).value;
                          if (!location) {
                            alert('Please enter manufacturing location');
                            return;
                          }
                          updateProductStatus(selectedProduct.id, 'manufactured', { location });
                        }}
                        disabled={updatingStatus === selectedProduct.id}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <Factory className="h-4 w-4" />
                        <span>{updatingStatus === selectedProduct.id ? 'Updating...' : 'Mark as Manufactured'}</span>
                      </button>
                    </div>
                  )}

                  {getNextStatus(selectedProduct.status) === 'delivered' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Delivery Tracking Number
                        </label>
                        <input
                          type="text"
                          id="trackingNumber"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                          placeholder="e.g., TR-12345"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const trackingNumber = (document.getElementById('trackingNumber') as HTMLInputElement).value;
                          if (!trackingNumber) {
                            alert('Please enter tracking number');
                            return;
                          }
                          updateProductStatus(selectedProduct.id, 'delivered', { trackingNumber });
                        }}
                        disabled={updatingStatus === selectedProduct.id}
                        className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <Truck className="h-4 w-4" />
                        <span>{updatingStatus === selectedProduct.id ? 'Updating...' : 'Mark as Delivered'}</span>
                      </button>
                    </div>
                  )}

                  {getNextStatus(selectedProduct.status) === 'installed' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Installation Location
                        </label>
                        <input
                          type="text"
                          id="installationLocation"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                          placeholder="e.g., Track Section A-123, Km 45.2"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const location = (document.getElementById('installationLocation') as HTMLInputElement).value;
                          if (!location) {
                            alert('Please enter installation location');
                            return;
                          }
                          updateProductStatus(selectedProduct.id, 'installed', { location });
                        }}
                        disabled={updatingStatus === selectedProduct.id}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <Wrench className="h-4 w-4" />
                        <span>{updatingStatus === selectedProduct.id ? 'Updating...' : 'Mark as Installed'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-8 shadow-sm text-center">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Product Selected</h3>
              <p className="text-gray-600 dark:text-gray-400">Select a product from the list to view its lifecycle details</p>
            </div>
          )}
        </div>
      </div>

      {/* Blockchain Audit Section */}
      {showAuditLogs && (
        <div className="mt-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Blockchain Audit Trail</h2>
                  <p className="text-gray-600 dark:text-gray-400">Complete transaction history and blockchain verification</p>
                </div>
                <div className="mt-4 sm:mt-0 flex space-x-3">
                  <button
                    onClick={exportAuditLogs}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export Audit Logs</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Audit Filters */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search audit logs..."
                    value={auditSearchTerm}
                    onChange={(e) => setAuditSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <select
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <Shield className="h-4 w-4" />
                  <span>{filteredAuditLogs.length} audit records found</span>
                </div>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white">Timestamp</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white">Action</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white">Product</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white">Transaction Hash</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white">Block Number</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white">Status</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {log.timestamp.toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {log.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          {getActionIcon(log.action)}
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {log.action.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{log.productName}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">ID: {log.productId}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Hash className="h-4 w-4 text-gray-400" />
                          <span className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all max-w-xs">
                            {log.txHash}
                          </span>
                          <button
                            onClick={() => window.open(`https://testnet.bscscan.com/tx/${log.txHash}`, '_blank')}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                          {log.blockNumber}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={clsx(
                          'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                          getAuditStatusColor(log.status)
                        )}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                          {log.details}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredAuditLogs.length === 0 && (
              <div className="p-8 text-center">
                <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Audit Records Found</h3>
                <p className="text-gray-600 dark:text-gray-400">No blockchain audit records match your current filters</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductLifecycle;
