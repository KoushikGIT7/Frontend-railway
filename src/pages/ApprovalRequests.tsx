import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, DollarSign, FileText, User, Calendar, QrCode, ExternalLink, Hash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiGenerateQR, apiApproveProduct } from '../services/blockchainApi';
import { db } from '../config/firebase';
import { collection, onSnapshot, orderBy, query, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

interface ApprovalRequest {
  id: string;
  type: 'product' | 'budget' | 'maintenance' | 'project';
  title: string;
  requestedBy: string;
  requestedByRole: string;
  amount?: number;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  documents?: string[];
  batchId?: string;
  qrGenerated?: boolean;
  blockchainTxHash?: string;
  blockchainId?: string;
  blockchainError?: string;
}

const ApprovalRequests: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    const q = query(collection(db, 'approvalRequests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const items: ApprovalRequest[] = [];
      snap.forEach((d) => {
        const data: any = d.data();
        const isProduct = data.type === 'product';
        const title = isProduct && data.products?.length ? data.products[0].productName : (data.title || 'Request');
        items.push({
          id: d.id,
          type: data.type || 'product',
          title,
          requestedBy: data.requestedBy || 'Inspector',
          requestedByRole: data.requestedByRole || 'inspector',
          amount: data.totalCost,
          description: isProduct && data.products?.length ? data.products[0].justification : (data.description || ''),
          priority: (data.products?.[0]?.urgency || 'medium') as any,
          status: (data.status || 'pending') as any,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          documents: data.documents || [],
          batchId: data.batchId,
          qrGenerated: !!data.qrGenerated,
          blockchainTxHash: data.blockchainTxHash,
          blockchainId: data.blockchainId,
          blockchainError: data.blockchainError,
        });
      });
      setRequests(items);
    });
    return () => unsub();
  }, [db]);

  const handleApproval = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        const request = requests.find(req => req.id === requestId);
        if (request && request.type === 'product') {
          // For product approvals with blockchain integration
          try {
            // First, try to approve on blockchain if we have a blockchain ID
            let blockchainApprovalResult = null;
            if (request.blockchainId && !request.blockchainError) {
              try {
                console.log('Approving product on blockchain:', request.blockchainId);
                blockchainApprovalResult = await apiApproveProduct({ id: parseInt(request.blockchainId) });
                
                if (blockchainApprovalResult.ok) {
                  console.log('✅ Product approved on blockchain:', blockchainApprovalResult.txHash);
                  
                  // Update Firestore with blockchain approval info
                  await updateDoc(doc(db, 'approvalRequests', requestId), {
                    status: 'approved',
                    batchId: blockchainApprovalResult.batchId,
                    qrGenerated: true,
                    approvedAt: serverTimestamp(),
                    approvedBy: user?.name || user?.email || 'DEN',
                    blockchainApprovalTxHash: blockchainApprovalResult.txHash,
                    blockchainApproved: true
                  });
                  
                  // Show success message with blockchain info
                  alert(`✅ Product Approved Successfully!\n\n🔗 Blockchain Transaction: ${blockchainApprovalResult.txHash}\n🔍 QR Code Generated: ${blockchainApprovalResult.batchId}\n\n📱 QR code contains complete batch details:\n• Quality Control Data\n• Technical Specifications\n• Supply Chain Information\n• Approval Details\n• Installation Plans`);
                  setSelectedRequest(null);
                  return;
                } else {
                  console.error('❌ Blockchain approval failed:', blockchainApprovalResult.error);
                }
              } catch (blockchainError) {
                console.error('❌ Blockchain approval error:', blockchainError);
              }
            }

            // Fallback: Generate QR code directly if blockchain approval failed or not available
            console.log('Generating QR code directly...');
            const qrResult = await apiGenerateQR({
              productId: requestId,
              productName: request.title,
              category: request.type,
              manufacturerId: request.requestedBy
            });
            
            if (qrResult.ok) {
              await updateDoc(doc(db, 'approvalRequests', requestId), {
                status: 'approved',
                batchId: qrResult.batchId,
                qrGenerated: true,
                approvedAt: serverTimestamp(),
                approvedBy: user?.name || user?.email || 'DEN',
                blockchainApproved: false,
                fallbackApproval: true
              });
              
              const message = blockchainApprovalResult 
                ? `✅ Product Approved!\n\n🔍 QR Code Generated: ${qrResult.batchId}\n\n⚠️ Note: Used fallback QR generation (blockchain approval failed)`
                : `✅ Product Approved!\n\n🔍 QR Code Generated: ${qrResult.batchId}\n\n📱 QR code contains complete batch details for scanning.`;
              
              alert(message);
            } else {
              throw new Error('QR generation failed');
            }
          } catch (approvalError) {
            console.error('Approval Error:', approvalError);
            
            // Final fallback: Approve in Firestore only
            await updateDoc(doc(db, 'approvalRequests', requestId), {
              status: 'approved',
              qrGenerated: false,
              approvedAt: serverTimestamp(),
              approvedBy: user?.name || user?.email || 'DEN',
              blockchainApproved: false,
              approvalError: 'Blockchain and QR generation failed - manual processing required'
            });
            
            alert('❌ Product approved but QR code generation failed.\n\nPlease generate QR code manually from Product Details page.');
          }
        } else {
          // For non-product approvals, just approve normally
          await updateDoc(doc(db, 'approvalRequests', requestId), {
            status: 'approved',
            approvedAt: serverTimestamp(),
            approvedBy: user?.name || user?.email || 'DEN'
          });
          alert('✅ Request approved successfully!');
        }
      } else {
        // Rejection doesn't need QR generation
        await updateDoc(doc(db, 'approvalRequests', requestId), {
          status: 'rejected',
          rejectedAt: serverTimestamp(),
          rejectedBy: user?.name || user?.email || 'DEN'
        });
        alert('❌ Request rejected.');
      }
      
      setSelectedRequest(null);
    } catch (error) {
      console.error('Approval Error:', error);
      alert('❌ Failed to process approval. Please try again.');
    }
  };

  const filteredRequests = requests.filter(req => 
    filter === 'all' || req.status === filter
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'budget': return <DollarSign className="h-5 w-5" />;
      case 'product': return <FileText className="h-5 w-5" />;
      case 'maintenance': return <AlertTriangle className="h-5 w-5" />;
      case 'project': return <CheckCircle className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Approval Requests</h1>
        <p className="text-gray-600 dark:text-gray-400">Review and process approval requests from your team</p>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
        <div className="flex space-x-4">
          {['all', 'pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-2 text-sm">
                ({status === 'all' ? requests.length : requests.filter(r => r.status === status).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredRequests.map((request) => (
          <div
            key={request.id}
            className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedRequest(request)}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="text-blue-600">
                  {getTypeIcon(request.type)}
                </div>
                <span className="font-medium text-gray-900 capitalize">{request.type}</span>
                {request.qrGenerated && (
                  <div className="flex items-center space-x-1 text-green-600">
                    <QrCode className="h-4 w-4" />
                    <span className="text-xs">QR Generated</span>
                  </div>
                )}
                {request.blockchainTxHash && (
                  <div className="flex items-center space-x-1 text-blue-600">
                    <Hash className="h-4 w-4" />
                    <span className="text-xs">Blockchain</span>
                  </div>
                )}
                {request.blockchainError && (
                  <div className="flex items-center space-x-1 text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs">Offline</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                  {request.priority}
                </span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                  {request.status}
                </span>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">{request.title}</h3>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{request.requestedBy} ({request.requestedByRole})</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>{request.createdAt.toLocaleDateString()}</span>
              </div>
              {request.amount && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <DollarSign className="h-4 w-4" />
                  <span>₹{(request.amount / 100000).toFixed(1)}L</span>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-700 mb-4 line-clamp-3">{request.description}</p>

            {request.status === 'pending' && (
              <div className="flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApproval(request.id, 'approve');
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Approve</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApproval(request.id, 'reject');
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Reject</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">{selectedRequest.title}</h2>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
                  <div className="flex items-center space-x-2">
                    <div className="text-blue-600">
                      {getTypeIcon(selectedRequest.type)}
                    </div>
                    <span className="capitalize font-medium">{selectedRequest.type}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedRequest.status)}`}>
                    {selectedRequest.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Requested By</label>
                  <p className="text-gray-900">{selectedRequest.requestedBy} ({selectedRequest.requestedByRole})</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedRequest.priority)}`}>
                    {selectedRequest.priority.toUpperCase()}
                  </span>
                </div>
                {selectedRequest.amount && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <p className="text-gray-900 font-semibold">₹{(selectedRequest.amount / 100000).toFixed(1)} Lakhs</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created Date</label>
                  <p className="text-gray-900">{selectedRequest.createdAt.toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-900">{selectedRequest.description}</p>
                </div>
              </div>

              {selectedRequest.documents && selectedRequest.documents.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Documents</label>
                  <div className="space-y-2">
                    {selectedRequest.documents.map((doc, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{doc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blockchain Information */}
              {(selectedRequest.blockchainTxHash || selectedRequest.blockchainError) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Blockchain Status</label>
                  <div className="space-y-2">
                    {selectedRequest.blockchainTxHash && (
                      <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <Hash className="h-4 w-4 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-800">Transaction Hash</p>
                          <p className="text-xs text-blue-600 font-mono break-all">{selectedRequest.blockchainTxHash}</p>
                        </div>
                        <button
                          onClick={() => {
                            const explorerUrl = `https://bscscan.com/tx/${selectedRequest.blockchainTxHash}`;
                            window.open(explorerUrl, '_blank');
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="View on BSCScan"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {selectedRequest.blockchainError && (
                      <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-orange-800">Blockchain Error</p>
                          <p className="text-xs text-orange-600">{selectedRequest.blockchainError}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedRequest.status === 'pending' && (
                <div className="flex space-x-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleApproval(selectedRequest.id, 'approve')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    <span>Approve Request</span>
                  </button>
                  <button
                    onClick={() => handleApproval(selectedRequest.id, 'reject')}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <XCircle className="h-5 w-5" />
                    <span>Reject Request</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{requests.length}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {requests.filter(r => r.status === 'pending').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-gray-900">
                {requests.filter(r => r.status === 'approved').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-gray-900">
                {requests.filter(r => r.status === 'rejected').length}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalRequests;