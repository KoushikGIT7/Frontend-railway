import React, { useState, useEffect } from 'react';
import { Package, Edit, Save, X, QrCode, Calendar, MapPin, Factory, Hash, Barcode, Download, FileDown, FileText, CheckCircle, RefreshCw } from 'lucide-react';
import { apiGetAllQRCodes } from '../services/blockchainApi';
import clsx from 'clsx';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';

interface ProductDetail {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  batchNumber: string;
  qrCode: string;
  barcode: string;
  blockchainHash: string;
  manufacturedDate: Date;
  specifications: {
    material: string;
    dimensions: string;
    weight: string;
    grade: string;
    standard: string;
  };
  status: 'manufactured' | 'dispatched' | 'installed' | 'inspected' | 'maintenance';
  location?: string;
  description: string;
  isApproved?: boolean;
  certifications: string[];
  testReports: string[];
}

interface QRCodeData {
  batchId: string;
  productId: string;
  manufacturerId: string;
  approvalDate: string;
  uniqueCode: string;
  productName: string;
  category: string;
  qrCodeImage: string;
  barcodeImage: string;
  barcodeValue: string;
  createdAt: string;
  batchDetails?: {
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
  };
}

const ProductDetails: React.FC = () => {
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductDetail | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [qrCodes, setQrCodes] = useState<QRCodeData[]>([]);
  const [searchParams] = useSearchParams();
  const [loadingQR, setLoadingQR] = useState(false);
  const [viewingQRData, setViewingQRData] = useState<QRCodeData | null>(null);
  const [zoomBarcode, setZoomBarcode] = useState<string | null>(null);

  const getViewerBase = () => {
    let base: string = (import.meta as any).env?.VITE_APP_URL || window.location.origin;
    if (typeof base === 'string' && base.includes('localhost')) {
      base = base.replace('localhost', '192.168.1.2');
    }
    // Map 192.168.1.5 to actual IP 192.168.1.2
    if (typeof base === 'string' && base.includes('192.168.1.5')) {
      base = base.replace('192.168.1.5', '192.168.1.2');
    }
    return base;
  };

  const getBarcodeBase = () => {
    // Prefer explicit API base, else derive from viewer base by swapping port to backend
    const explicit = (import.meta as any).env?.VITE_API_BASE as string | undefined;
    if (explicit) {
      // Map 192.168.1.5 to actual IP 192.168.1.2
      return explicit.replace('192.168.1.5', '192.168.1.2').replace('localhost', '192.168.1.2');
    }
    const viewer = getViewerBase();
    if (viewer.includes(':5173')) return viewer.replace(':5173', ':8788');
    return viewer;
  };

  // Frontend-only fallback: if a batchId is supplied in the URL and no API base is used, load from Firestore
  useEffect(() => {
    const batchParam = searchParams.get('batch') || searchParams.get('batchId');
    const apiBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
    if (!batchParam || apiBase) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'qrCodes', batchParam));
        if (snap.exists()) {
          const data: any = snap.data();
          const normalized: QRCodeData = {
            batchId: batchParam,
            productId: data?.productId || '',
            manufacturerId: data?.manufacturerId || '',
            approvalDate: data?.approvalDate || '',
            uniqueCode: data?.uniqueCode || '',
            productName: data?.productName || '',
            category: data?.category || '',
            qrCodeImage: data?.qrCodeImage || '',
            barcodeImage: data?.barcodeImage || '',
            barcodeValue: data?.barcodeValue || '',
            createdAt: data?.createdAt || new Date().toISOString(),
            batchDetails: data?.batchDetails
          };
          setQrCodes((prev) => {
            const exists = prev.find((q) => q.batchId === normalized.batchId);
            return exists ? prev : [normalized, ...prev];
          });
        }
      } catch {}
    })();
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      // Load products from Firestore for fast access
      await loadProducts();
      await loadQRCodes();
    })();
  }, []);


  // Ensure every backend QR batch appears as a full product card with the same styling as existing ones
  useEffect(() => {
    if (!qrCodes || qrCodes.length === 0) return;
    try {
      const existingIds = new Set(products.map(p => p.id));
      const newProducts: ProductDetail[] = [];
      for (const qr of qrCodes) {
        // Normalize an ID for product card
        const normalizedId = qr.productId ? `API-${qr.productId}` : `API-${qr.batchId}`;
        if (existingIds.has(normalizedId)) continue;

        // Prefer real values from batchDetails when available
        const basic = qr.batchDetails?.basicInfo;
        const qc = qr.batchDetails?.qualityControl;
        const specs = qr.batchDetails?.specifications;
        const install = qr.batchDetails?.installation;

        const realName = basic?.productName || qr.productName || 'Approved Product';
        const realCategory = basic?.category || qr.category || 'General';
        const realManufacturer = basic?.manufacturer || qr.manufacturerId || 'Manufacturer';
        const realLocation = basic?.location || 'Manufacturing Facility';
        const realMfgDateStr = basic?.manufacturingDate;
        const realMfgDate = realMfgDateStr ? new Date(realMfgDateStr) : new Date(qr.createdAt || Date.now());

        // Status heuristic based on available sections
        const status: ProductDetail['status'] = install?.estimatedInstallDate
          ? 'installed'
          : qc?.testDate
          ? 'inspected'
          : 'manufactured';

        newProducts.push({
          id: normalizedId,
          name: realName,
          category: realCategory,
          manufacturer: realManufacturer,
          batchNumber: qr.batchId,
          qrCode: qr.uniqueCode || '',
          barcode: qr.barcodeValue || '',
          blockchainHash: qr.batchDetails?.approval?.blockchainHash || `0x${Math.random().toString(16).substr(2, 40)}`,
          manufacturedDate: realMfgDate,
          specifications: {
            material: specs?.material || 'High Quality Steel',
            dimensions: specs?.tensileStrength ? `TS ${specs.tensileStrength}` : 'Standard Size',
            weight: 'Variable',
            grade: qc?.grade || 'Premium',
            standard: 'ISO 9001'
          },
          status,
          location: realLocation,
          description: `Batch ${qr.batchId} • Approved ${qr.batchDetails?.approval?.approvalDate || new Date(qr.createdAt || Date.now()).toISOString().split('T')[0]} • ${realManufacturer}`,
          certifications: [
            'ISO 9001:2015',
            'RDSO Approval',
            ...(qc?.certificationNumber ? [qc.certificationNumber] : [])
          ],
          testReports: [
            qc?.testResults ? `QC Results: ${qc.testResults}` : 'Quality Control Report',
            specs?.chemicalComposition ? `Chem: ${specs.chemicalComposition}` : 'Inspection Report'
          ]
        });
        existingIds.add(normalizedId);
      }
      if (newProducts.length > 0) {
        setProducts(prev => [...prev, ...newProducts]);
      }
    } catch (e) {
      console.warn('Failed to merge QR batches into products:', e);
    }
  }, [qrCodes]);

  // Real-time: refresh QR codes when any request is approved and QR generated
  // Only refresh if no product is currently selected to avoid disrupting user experience
  useEffect(() => {
    try {
      const q = query(
        collection(db, 'approvalRequests'),
        where('status', '==', 'approved'),
        where('qrGenerated', '==', true)
      );
      const unsub = onSnapshot(q, async () => {
        try {
          // Only refresh if no product is selected to avoid disrupting user
          if (!selectedProduct) {
            console.log('📡 Detected approved request with QR in Firestore → refreshing products & QR');
            await loadProducts();
            await loadQRCodes();
          } else {
            console.log('📡 New approval detected but product selected - skipping auto-refresh to preserve user experience');
          }
        } catch (e) {
          console.error('Failed refreshing after approval snapshot:', e);
        }
      });
      return () => unsub();
    } catch (e) {
      console.warn('Realtime approvals listener unavailable:', e);
    }
  }, [selectedProduct]);

  // Manual refresh function that preserves selected product
  const handleManualRefresh = async () => {
    try {
      console.log('🔄 Manual refresh initiated...');
      const currentSelectedId = selectedProduct?.id;
      
      await loadProducts();
      await loadQRCodes();
      
      // Restore selected product if it still exists
      if (currentSelectedId) {
        const restoredProduct = products.find(p => p.id === currentSelectedId);
        if (restoredProduct) {
          setSelectedProduct(restoredProduct);
          console.log('✅ Selected product restored after refresh');
        } else {
          console.log('⚠️ Previously selected product no longer available');
        }
      }
      
      console.log('✅ Manual refresh completed');
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
    }
  };

  const loadQRCodes = async () => {
    setLoadingQR(true);
    try {
      console.log('🔄 Loading QR codes from backend...');
      
      // Try to load from backend first (non-blocking)
      const backendPromise = apiGetAllQRCodes()
        .then(response => {
          if (response.ok && response.qrCodes && response.qrCodes.length > 0) {
            console.log(`✅ Loaded ${response.qrCodes.length} QR codes from backend`);
            return response.qrCodes;
          }
          return [];
        })
        .catch(error => {
          console.warn('❌ Backend QR codes failed:', error);
          return [];
        });

      // Generate mock QR codes immediately for fast UI
      const mockQRCodes = await generateMockQRCodes();
      setQrCodes(mockQRCodes);
      console.log(`✅ Generated ${mockQRCodes.length} mock QR codes for immediate display`);
      
      // Try to load real data in background
      try {
        const backendQRCodes = await backendPromise;
        if (backendQRCodes.length > 0) {
          // Process backend QR codes
          const barcodeBase = getBarcodeBase();
          const normalizedCodes: QRCodeData[] = [];
          
          for (const qr of backendQRCodes) {
            try {
              const shortCode = (qr.batchId || '').toString().replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase();
              const shortUrl = `${barcodeBase}/b/${shortCode}`;
              const barcodeImage = await generateBarcode(shortUrl);
              normalizedCodes.push({
                ...qr,
                barcodeValue: shortUrl,
                barcodeImage
              });
            } catch {
              normalizedCodes.push(qr);
            }
          }
          
          // Merge with mock data
          const mergedQRCodes = [...mockQRCodes, ...normalizedCodes];
          setQrCodes(mergedQRCodes);
          console.log(`✅ Total QR codes loaded: ${mergedQRCodes.length} (${mockQRCodes.length} mock + ${normalizedCodes.length} real)`);
        }
      } catch (error) {
        console.log('⚠️ Background QR loading failed, using mock data only');
      }
      
    } catch (error) {
      console.error('❌ Error loading QR codes:', error);
      // Fallback to mock QR codes
      try {
        const mockQRCodes = await generateMockQRCodes();
        setQrCodes(mockQRCodes);
        console.log(`✅ Generated ${mockQRCodes.length} fallback QR codes`);
      } catch (mockError) {
        console.error('❌ Failed to generate mock QR codes:', mockError);
      }
    } finally {
      setLoadingQR(false);
    }
  };

  // Generate barcode as data URL
  const generateBarcode = async (value: string): Promise<string> => {
    try {
      const JsBarcode = (await import('jsbarcode')).default;
      const canvas = document.createElement('canvas');
      // Compact size for half-width while keeping clarity
      canvas.width = 260;
      canvas.height = 140;
      
      // Encode full value directly (URL), so scanners show a clickable link
      const scannableValue = value;
      JsBarcode(canvas, scannableValue, {
        format: "CODE128",
        width: 1.5,
        height: 90,
        displayValue: true,
        fontSize: 12,
        margin: 6,
        background: "#ffffff",
        lineColor: "#000000",
        textAlign: "center",
        textPosition: "bottom",
        textMargin: 4
      });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generating barcode:', error);
      // Fallback: create a simple text-based barcode representation
      const svgContent = `<svg width="240" height="110" xmlns="http://www.w3.org/2000/svg">
        <rect width="240" height="110" fill="white" stroke="black"/>
        <text x="120" y="55" text-anchor="middle" font-family="monospace" font-size="12">${value}</text>
      </svg>`;
      return `data:image/svg+xml;base64,${btoa(svgContent)}`;
    }
  };

  // Generate mock QR codes for demonstration
  const generateMockQRCodes = async (): Promise<QRCodeData[]> => {
    let toDataURL: any = null;
    try {
      const qrModule: any = await import('qrcode');
      toDataURL = qrModule.toDataURL || qrModule.default?.toDataURL;
    } catch (e) {
      console.warn('qrcode library import failed, will use fallback service');
    }
    
    const mockQRCodes: QRCodeData[] = [];
    // Fallback sample products if product list is not yet populated
    const baseProducts: any[] = (products && products.length > 0)
      ? products
      : [
          { id: 'RAIL-JOINT-RJ456', name: 'Heavy Duty Rail Joint', category: 'Rail Components', manufacturer: 'Steel Works India Ltd.' },
          { id: 'SIGNAL-BOX-SB789', name: 'Digital Signal Control Box', category: 'Signaling Equipment', manufacturer: 'Railway Electronics Corp.' },
          { id: 'TRACK-BOLT-TB321', name: 'High Tensile Track Bolt', category: 'Fastening Systems', manufacturer: 'Precision Fasteners Ltd.' }
        ];

    for (const product of baseProducts) {
      const batchId = `BATCH-${product.id}-${Date.now()}`;
      const mockData = {
        batchId: batchId,
        productId: product.id,
        manufacturerId: product.manufacturer,
        approvalDate: new Date().toISOString(),
        uniqueCode: `QR-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        productName: product.name,
        category: product.category,
        batchDetails: {
          basicInfo: {
            batchNumber: batchId,
            productName: product.name,
            category: product.category,
            manufacturingDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            expiryDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            batchSize: Math.floor(Math.random() * 500) + 100,
            manufacturer: product.manufacturer,
            location: 'Mumbai Manufacturing Unit'
          },
          qualityControl: {
            grade: ['A+', 'A', 'B+'][Math.floor(Math.random() * 3)],
            testResults: `${90 + Math.floor(Math.random() * 10)}%`,
            inspector: 'QC Inspector Sharma',
            certificationNumber: `CERT-${Math.floor(Math.random() * 100000)}`,
            testDate: new Date().toISOString().split('T')[0],
            compliance: 'IS 2062:2011, RDSO/PE/SPEC/AC/0116-2014'
          },
          specifications: {
            material: 'High Carbon Steel Grade 880',
            tensileStrength: `${750 + Math.floor(Math.random() * 100)} N/mm²`,
            yieldStrength: `${450 + Math.floor(Math.random() * 50)} N/mm²`,
            elongation: `${18 + Math.floor(Math.random() * 7)}%`,
            hardness: `${200 + Math.floor(Math.random() * 50)} HB`,
            chemicalComposition: 'C: 0.65%, Mn: 0.80%, Si: 0.25%'
          },
          supplyChain: {
            rawMaterialSource: 'SAIL Bhilai Steel Plant',
            transportMode: 'Rail Freight',
            deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            destinationDivision: 'Western Railway Division',
            trackingNumber: `TR-${Math.floor(Math.random() * 100000)}`,
            handledBy: 'Indian Railways Logistics'
          },
          approval: {
            approvedBy: 'DEN Central Mumbai',
            approvalDate: new Date().toISOString().split('T')[0],
            approvalNumber: `APP-${Math.floor(Math.random() * 100000000)}`,
            digitalSignature: 'Verified',
            blockchainHash: `0x${Math.random().toString(16).substr(2, 40)}`,
            qrGeneratedAt: new Date().toISOString()
          },
          installation: {
            plannedInstallation: 'Track Section A-123, Km 45.2',
            installationTeam: 'PWay Gang No. 15',
            estimatedInstallDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            maintenanceSchedule: 'Monthly Visual, Quarterly UTM',
            warrantyPeriod: '5 Years',
            replacementCycle: '2029-2034'
          }
        }
      };

      // Cache full data locally so the viewer can render instantly
      try { sessionStorage.setItem(`qr:${batchId}`, JSON.stringify(mockData)); } catch {}
      // Use compact URL with only batchId to keep QR size very small
      // In production, this will be your deployed domain
      const viewerBase = getViewerBase();
      const barcodeBase = getBarcodeBase();
      const viewerUrl = `${viewerBase}/qr/${batchId}`;
      try {
        if (!toDataURL) throw new Error('qrcode.toDataURL not available');
        const qrCodeDataURL = await toDataURL(viewerUrl, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          width: 256
        });

        // Generate barcode for the batch - create a scannable barcode value
        // Use compact redirecting link for barcode to keep length short
        const shortCode = (batchId).toString().replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase();
        const barcodeValue = `${barcodeBase}/b/${shortCode}`;
        const barcodeImage = await generateBarcode(barcodeValue);

        mockQRCodes.push({
          ...mockData,
          qrCodeImage: qrCodeDataURL,
          barcodeImage: barcodeImage,
          barcodeValue: barcodeValue,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error generating mock QR code (using fallback service):', error);
        // Fallback: use external QR service to ensure a scannable QR is produced
        const fallbackPng = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&ecc=L&data=${encodeURIComponent(viewerUrl)}`;
        const shortCode = (batchId).toString().replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase();
        const barcodeValue = `${barcodeBase}/b/${shortCode}`;
        const barcodeImage = await generateBarcode(barcodeValue);
        
        mockQRCodes.push({
          ...mockData,
          qrCodeImage: fallbackPng,
          barcodeImage: barcodeImage,
          barcodeValue: barcodeValue,
          createdAt: new Date().toISOString()
        });
      }
    }

    return mockQRCodes;
  };

  const loadProducts = async () => {
    try {
      // Load mock products immediately for fast UI
      const mockProducts: ProductDetail[] = [
        {
          id: 'RAIL-JOINT-RJ456',
          name: 'Heavy Duty Rail Joint',
          category: 'Rail Components',
          manufacturer: 'Steel Works India Ltd.',
          batchNumber: 'BATCH2024-001',
          qrCode: 'QR-RJ456-2024',
          barcode: '1234567890123',
          blockchainHash: '0x123abc456def789ghi012jkl345mno678pqr901stu234vwx567yza890bcd',
          manufacturedDate: new Date('2024-01-15'),
          specifications: {
            material: 'High Carbon Steel',
            dimensions: '150mm x 100mm x 25mm',
            weight: '12.5 kg',
            grade: 'Grade A',
            standard: 'IS 2062:2011'
          },
          status: 'installed',
          location: 'Track Section A-123, Mumbai Division',
          description: 'Heavy-duty rail joint designed for high-traffic railway sections. Manufactured using premium grade steel with enhanced durability and corrosion resistance.',
          certifications: ['ISO 9001:2015', 'RDSO Approval', 'BIS Certification'],
          testReports: ['Tensile Test Report', 'Impact Test Report', 'Chemical Analysis Report']
        },
        {
          id: 'SIGNAL-BOX-SB789',
          name: 'Digital Signal Control Box',
          category: 'Signaling Equipment',
          manufacturer: 'Railway Electronics Corp.',
          batchNumber: 'BATCH2024-002',
          qrCode: 'QR-SB789-2024',
          barcode: '2345678901234',
          blockchainHash: '0x456def789abc123ghi456jkl789mno012pqr345stu678vwx901yza234bcd',
          manufacturedDate: new Date('2024-01-10'),
          specifications: {
            material: 'Aluminum Alloy Housing',
            dimensions: '300mm x 200mm x 150mm',
            weight: '8.2 kg',
            grade: 'IP65 Rated',
            standard: 'IEC 61508'
          },
          status: 'maintenance',
          location: 'Signal Post SP-45, Delhi Division',
          description: 'Advanced digital signal control box with microprocessor-based control system. Features remote monitoring capabilities and fail-safe operation.',
          certifications: ['CE Marking', 'RDSO Approval', 'FCC Certification'],
          testReports: ['EMC Test Report', 'Environmental Test Report', 'Functional Test Report']
        },
        {
          id: 'TRACK-BOLT-TB321',
          name: 'High Tensile Track Bolt',
          category: 'Fastening Systems',
          manufacturer: 'Precision Fasteners Ltd.',
          batchNumber: 'BATCH2024-003',
          qrCode: 'QR-TB321-2024',
          barcode: '3456789012345',
          blockchainHash: '0x789abc123def456ghi789jkl012mno345pqr678stu901vwx234yza567bcd',
          manufacturedDate: new Date('2024-01-12'),
          specifications: {
            material: 'Alloy Steel',
            dimensions: 'M24 x 120mm',
            weight: '0.8 kg',
            grade: '8.8 Grade',
            standard: 'IS 1367:2002'
          },
          status: 'dispatched',
          location: 'In Transit to Chennai Division',
          description: 'High-strength track bolts manufactured from premium alloy steel. Designed for secure fastening of rail components with superior corrosion resistance.',
          certifications: ['IS Certification', 'RDSO Approval'],
          testReports: ['Proof Load Test', 'Hardness Test Report', 'Coating Thickness Report']
        }
      ];

      // Set mock products immediately for fast UI
      setProducts(mockProducts);
      if (mockProducts.length > 0) {
        setSelectedProduct(mockProducts[0]);
      }
      
      // Try to load real data in background (non-blocking)
      const firestorePromise = fetch('/api/getProductsFast')
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Firestore API not available');
        })
        .then(data => {
          if (data.products && data.products.length > 0) {
            // Convert Firestore products to ProductDetail format
            const firestoreProducts: ProductDetail[] = data.products.map((product: any) => ({
              id: `LIVE-${product.id}`,
              name: product.name,
              category: product.category,
              manufacturer: product.manufacturer || 'Manufacturer',
              batchNumber: product.batchNumber || `BATCH-${product.id}`,
              qrCode: product.qrCode || `QR-${product.id}`,
              barcode: product.barcode || `1234567890${product.id}`,
              blockchainHash: '', // Hidden from manufacturer
              manufacturedDate: product.manufacturedDate ? new Date(product.manufacturedDate) : new Date(),
              specifications: {
                material: product.material || 'High Quality Steel',
                dimensions: product.dimensions || 'Standard Size',
                weight: product.weight || 'Variable',
                grade: product.grade || 'Premium',
                standard: product.standard || 'ISO 9001'
              },
              status: product.status || 'manufactured',
              location: product.location || 'Manufacturing Facility',
              description: product.description || `Product: ${product.name}`,
              certifications: product.certifications || ['ISO 9001:2015', 'RDSO Approval'],
              testReports: product.testReports || ['Quality Control Report', 'Inspection Report']
            }));
            
            return firestoreProducts;
          }
          return [];
        })
        .catch(error => {
          console.log('⚠️ Firestore unavailable, using mock data only:', error);
          return [];
        });

      // Try to load real data in background
      try {
        const firestoreProducts = await firestorePromise;
        if (firestoreProducts.length > 0) {
          // Merge real products with mock data
          const mergedProducts = [...mockProducts, ...firestoreProducts];
          setProducts(mergedProducts);
          console.log('✅ Loaded mock + live products:', mergedProducts.length);
        }
      } catch (error) {
        console.log('⚠️ Background loading failed, using mock data only');
      }

    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleEdit = (product: ProductDetail) => {
    setEditingProduct({ ...product });
  };

  const handleSave = () => {
    if (editingProduct) {
      setProducts(products.map(p => 
        p.id === editingProduct.id ? editingProduct : p
      ));
      if (selectedProduct?.id === editingProduct.id) {
        setSelectedProduct(editingProduct);
      }
      setEditingProduct(null);
    }
  };

  const handleCancel = () => {
    setEditingProduct(null);
  };

  const downloadQRCode = (qrData: QRCodeData, format: 'png' | 'pdf' | 'svg' | 'dxf' | 'barcode') => {
    try {
      if (format === 'png') {
        // Download as PNG - High resolution for printing
        const link = document.createElement('a');
        link.href = qrData.qrCodeImage;
        link.download = `QR_${qrData.batchId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
      } else if (format === 'svg') {
        // Generate SVG for CAD software compatibility
        const svgQR = generateSVGQR(qrData);
        const blob = new Blob([svgQR], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `QR_${qrData.batchId}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
      } else if (format === 'dxf') {
        // Generate DXF for AutoCAD compatibility
        const dxfContent = generateDXFQR(qrData);
        const blob = new Blob([dxfContent], { type: 'application/dxf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `QR_${qrData.batchId}.dxf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
      } else if (format === 'barcode') {
        // Download barcode as PNG
        const link = document.createElement('a');
        link.href = qrData.barcodeImage;
        link.download = `Barcode_${qrData.batchId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
      } else if (format === 'pdf') {
        // Create proper PDF with QR code and metadata
        generatePDFQR(qrData);
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    }
  };

  // Generate SVG QR Code for CAD software
  const generateSVGQR = (qrData: QRCodeData): string => {
    const qrSize = 200;
    const margin = 20;
    const totalSize = qrSize + (margin * 2);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${totalSize}" height="${totalSize + 100}" xmlns="http://www.w3.org/2000/svg">
  <!-- QR Code Background -->
  <rect x="0" y="0" width="${totalSize}" height="${totalSize}" fill="white" stroke="black" stroke-width="1"/>
  
  <!-- QR Code Placeholder (In real implementation, generate actual QR matrix) -->
  <image x="${margin}" y="${margin}" width="${qrSize}" height="${qrSize}" href="${qrData.qrCodeImage}"/>
  
  <!-- Metadata -->
  <text x="${totalSize/2}" y="${totalSize + 20}" text-anchor="middle" font-family="Arial" font-size="12" fill="black">
    Batch: ${qrData.batchId}
  </text>
  <text x="${totalSize/2}" y="${totalSize + 35}" text-anchor="middle" font-family="Arial" font-size="10" fill="black">
    Code: ${qrData.uniqueCode}
  </text>
  <text x="${totalSize/2}" y="${totalSize + 50}" text-anchor="middle" font-family="Arial" font-size="10" fill="black">
    Product: ${qrData.productName}
  </text>
</svg>`;
  };

  // Generate DXF for AutoCAD
  const generateDXFQR = (qrData: QRCodeData): string => {
    const qrSize = 200;
    return `0
SECTION
2
HEADER
9
$DWGCODEPAGE
3
ANSI_1252
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
5
100
100
AcDbEntity
8
QR-BOUNDARY
100
AcDbPolyline
90
4
70
1
43
0
10
0
20
0
10
${qrSize}
20
0
10
${qrSize}
20
${qrSize}
10
0
20
${qrSize}
0
TEXT
5
101
100
AcDbEntity
8
QR-TEXT
100
AcDbText
10
${qrSize/2}
20
${qrSize + 10}
40
12
1
Batch: ${qrData.batchId}
0
TEXT
5
102
100
AcDbEntity
8
QR-TEXT
100
AcDbText
10
${qrSize/2}
20
${qrSize + 25}
40
8
1
Code: ${qrData.uniqueCode}
0
ENDSEC
0
EOF`;
  };

  // Generate PDF with proper formatting
  const generatePDFQR = (qrData: QRCodeData) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 600;
      canvas.height = 800;
      
      if (ctx) {
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Header with Indian Railways branding
        ctx.fillStyle = '#003366';
        ctx.fillRect(0, 0, canvas.width, 80);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('भारतीय रेल - Indian Railways', canvas.width / 2, 30);
        ctx.font = 'bold 18px Arial';
        ctx.fillText('Product QR Code Certificate', canvas.width / 2, 55);
        
        // QR Code with border
        const qrSize = 250;
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = 120;
        
        // QR Border
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 2;
        ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
        
        // QR Code
        ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
        
        // Product details in table format
        ctx.fillStyle = 'black';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        
        const details = [
          ['Batch ID:', qrData.batchId],
          ['Product Name:', qrData.productName],
          ['Category:', qrData.category],
          ['Unique Code:', qrData.uniqueCode],
          ['Approval Date:', new Date(qrData.approvalDate).toLocaleDateString()],
          ['Manufacturer:', qrData.manufacturerId],
          ['Generated:', new Date(qrData.createdAt).toLocaleDateString()]
        ];
        
        let yPos = qrY + qrSize + 60;
        details.forEach(([label, value]) => {
          ctx.font = 'bold 14px Arial';
          ctx.fillText(label, 80, yPos);
          ctx.font = '14px Arial';
          ctx.fillText(value, 220, yPos);
          yPos += 25;
        });
        
        // Footer
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        ctx.fillText('This QR code is generated automatically upon approval', canvas.width / 2, canvas.height - 40);
        ctx.fillText('Scan to verify product authenticity and track supply chain', canvas.width / 2, canvas.height - 25);
        
        // Convert to PDF and download
        canvas.toBlob(blob => {
          if (blob) {
            // Create a proper PDF (for now using canvas image, can be enhanced with jsPDF)
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `QR_Certificate_${qrData.batchId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        }, 'image/png');
      }
    };
    
    img.src = qrData.qrCodeImage;
  };

  // Get QR code for current product
  const getProductQRCode = (productId: string): QRCodeData | undefined => {
    // Handle both regular product IDs and API product IDs
    const searchId = productId.startsWith('API-') ? productId.replace('API-', '') : productId;
    return qrCodes.find(qr => qr.productId === searchId);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'manufactured':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'dispatched':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'installed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inspected':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'maintenance':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="mb-8">

        <div className="flex items-center justify-between">
          <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Product Details
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage product codes, manufacturing info, specifications, and batch numbers
        </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleManualRefresh}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh All</span>
            </button>
            <button
              onClick={loadQRCodes}
              disabled={loadingQR}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <QrCode className="h-4 w-4" />
              <span>{loadingQR ? 'Loading...' : 'Refresh QR Codes'}</span>
            </button>
            <button
              onClick={async () => {
                try {
                  console.log('🎯 Generating fresh test QR codes...');
                  setLoadingQR(true);
                  setQrCodes([]);
                  
                  const mockQRCodes = await generateMockQRCodes();
                  setQrCodes(mockQRCodes);
                  
                  console.log(`✅ Generated ${mockQRCodes.length} fresh test QR codes`);
                  console.log(`🎯 Generated ${mockQRCodes.length} fresh test QR codes!`);
                } catch (error) {
                  console.error('❌ Error generating test QR codes:', error);
                  console.error('❌ Failed to generate test QR codes. Please check console for details.');
                } finally {
                  setLoadingQR(false);
                }
              }}
              disabled={loadingQR}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Package className="h-4 w-4" />
              <span>{loadingQR ? 'Generating...' : 'Generate Test QR Codes'}</span>
            </button>
            <button
              onClick={async () => {
                try {
                  console.log('🧪 Opening test QR viewer...');
                  
                  // Generate comprehensive test data
                  const testData = {
                    batchId: 'BATCH-TEST-' + Date.now(),
                    productId: 'TEST-001',
                    manufacturerId: 'Steel Works India Ltd.',
                    approvalDate: new Date().toISOString(),
                    uniqueCode: `QR-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
                    productName: 'Heavy Duty Rail Joint - Test',
                    category: 'Rail Components',
                    batchDetails: {
                      basicInfo: {
                        batchNumber: 'BATCH-TEST-' + Date.now(),
                        productName: 'Heavy Duty Rail Joint - Test',
                        category: 'Rail Components',
                        manufacturingDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        expiryDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        batchSize: 250,
                        manufacturer: 'Steel Works India Ltd.',
                        location: 'Mumbai Manufacturing Unit'
                      },
                      qualityControl: {
                        grade: 'A+',
                        testResults: '96%',
                        inspector: 'QC Inspector Sharma',
                        certificationNumber: 'CERT-TEST-12345',
                        testDate: new Date().toISOString().split('T')[0],
                        compliance: 'IS 2062:2011, RDSO/PE/SPEC/AC/0116-2014'
                      },
                      specifications: {
                        material: 'High Carbon Steel Grade 880',
                        tensileStrength: '820 N/mm²',
                        yieldStrength: '485 N/mm²',
                        elongation: '22%',
                        hardness: '235 HB',
                        chemicalComposition: 'C: 0.65%, Mn: 0.80%, Si: 0.25%'
                      },
                      supplyChain: {
                        rawMaterialSource: 'SAIL Bhilai Steel Plant',
                        transportMode: 'Rail Freight',
                        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        destinationDivision: 'Western Railway Division',
                        trackingNumber: 'TR-TEST-98765',
                        handledBy: 'Indian Railways Logistics'
                      },
                      approval: {
                        approvedBy: 'DEN Central Mumbai',
                        approvalDate: new Date().toISOString().split('T')[0],
                        approvalNumber: 'APP-TEST-54321',
                        digitalSignature: 'Verified',
                        blockchainHash: '0xtest123456789abcdef',
                        qrGeneratedAt: new Date().toISOString()
                      },
                      installation: {
                        plannedInstallation: 'Track Section A-123, Km 45.2',
                        installationTeam: 'PWay Gang No. 15',
                        estimatedInstallDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        maintenanceSchedule: 'Monthly Visual, Quarterly UTM',
                        warrantyPeriod: '5 Years',
                        replacementCycle: '2029-2034'
                      }
                    }
                  };
                  
                  const url = `http://192.168.91.227:5173/qr?data=${encodeURIComponent(JSON.stringify(testData))}`;
                  console.log('🔗 Opening QR viewer URL:', url);
                  window.open(url, '_blank');
                  
                  console.log('🧪 Test QR Viewer opened!');
                } catch (error) {
                  console.error('❌ Error opening test QR viewer:', error);
                  console.error('❌ Failed to open test QR viewer. Please check console for details.');
                }
              }}
              className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <QrCode className="h-4 w-4" />
              <span>Test QR Viewer</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Product List */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 shadow-sm">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => (
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
                    <Package className="h-4 w-4 text-primary-600" />
                    <span className="font-medium text-gray-900 dark:text-white text-sm">{product.name}</span>
                    {product.id.startsWith('API-') && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {product.id.startsWith('API-') ? `API Product #${product.id.replace('API-', '')}` : product.id}
                  </p>
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

        {/* Product Details */}
        <div className="lg:col-span-3">
          {selectedProduct && (
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedProduct.name}
                </h2>
                  {selectedProduct.id.startsWith('API-') && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      LIVE DATA
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={clsx(
                    'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                    getStatusColor(selectedProduct.status)
                  )}>
                    {selectedProduct.status.toUpperCase()}
                  </span>
                  <button
                    onClick={() => handleEdit(selectedProduct)}
                    className="bg-primary-600 hover:bg-primary-700 text-white p-2 rounded-lg transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product ID</label>
                    <p className="text-gray-900 dark:text-white font-mono">{selectedProduct.id}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <p className="text-gray-900 dark:text-white">{selectedProduct.category}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manufacturer</label>
                    <div className="flex items-center space-x-2">
                      <Factory className="h-4 w-4 text-gray-400" />
                      <p className="text-gray-900 dark:text-white">{selectedProduct.manufacturer}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch Number</label>
                    <p className="text-gray-900 dark:text-white font-mono">{selectedProduct.batchNumber}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manufactured Date</label>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <p className="text-gray-900 dark:text-white">{selectedProduct.manufacturedDate.toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <p className="text-gray-900 dark:text-white">{selectedProduct.location}</p>
                    </div>
                  </div>
                </div>

                {/* Codes and Identification */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Codes & Identification</h3>
                  
                  {(() => {
                    const productQR = getProductQRCode(selectedProduct.id);
                    return productQR ? (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-4">Generated Codes & Identification</label>
                        
                        {/* QR Code and Barcode Display */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {/* QR Code */}
                          <div className="text-center">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">QR Code</h4>
                            <img 
                              src={productQR.qrCodeImage} 
                              alt="Product QR Code"
                              className="w-32 h-32 border border-gray-300 rounded-lg mx-auto"
                            />
                            <p className="text-xs text-gray-500 mt-1">Scan for batch details</p>
                          </div>
                          
                          {/* Barcode */}
                          <div className="text-center">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Barcode</h4>
                            <button
                              onClick={() => setZoomBarcode(productQR.barcodeImage)}
                              className="w-full mx-auto overflow-hidden border border-gray-300 rounded-lg bg-white p-2 block hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
                              title="Click to zoom"
                            >
                              <img
                                src={productQR.barcodeImage}
                                alt="Product Barcode"
                                className="w-full h-20 md:h-24 object-contain"
                              />
                            </button>
                            <p className="text-xs text-gray-500 mt-1 break-all">Code: {productQR.barcodeValue}</p>
                            <p className="text-xs text-blue-600 mt-1">
                              <a href="/barcode" target="_blank" className="underline">
                                Scan this barcode →
                              </a>
                            </p>
                    </div>
                  </div>

                        {/* Batch Information */}
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Batch ID:</span>
                            <span className="ml-2 font-mono text-gray-900 dark:text-white">{productQR.batchId}</span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Unique Code:</span>
                            <span className="ml-2 font-mono text-gray-900 dark:text-white">{productQR.uniqueCode}</span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Generated:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">{new Date(productQR.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="space-y-2 mt-3">
                            <button
                              onClick={() => setViewingQRData(productQR)}
                              className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                              title="View complete batch data that QR contains"
                            >
                              <QrCode className="h-4 w-4" />
                              <span>View QR Data (Table Format)</span>
                            </button>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => downloadQRCode(productQR, 'png')}
                                className="flex items-center justify-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors"
                                title="High-resolution PNG for printing"
                              >
                                <Download className="h-3 w-3" />
                                <span>QR PNG</span>
                              </button>
                              <button
                                onClick={() => downloadQRCode(productQR, 'barcode')}
                                className="flex items-center justify-center space-x-1 bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs transition-colors"
                                title="Download barcode as PNG"
                              >
                                <Barcode className="h-3 w-3" />
                                <span>Barcode</span>
                              </button>
                              <button
                                onClick={() => downloadQRCode(productQR, 'pdf')}
                                className="flex items-center justify-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs transition-colors"
                                title="PDF Certificate with Indian Railways branding"
                              >
                                <FileDown className="h-3 w-3" />
                                <span>PDF</span>
                              </button>
                              <button
                                onClick={() => downloadQRCode(productQR, 'svg')}
                                className="flex items-center justify-center space-x-1 bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs transition-colors"
                                title="SVG vector format for CAD software"
                              >
                                <FileText className="h-3 w-3" />
                                <span>SVG</span>
                              </button>
                              <button
                                onClick={() => downloadQRCode(productQR, 'dxf')}
                                className="flex items-center justify-center space-x-1 bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded text-xs transition-colors"
                                title="DXF format for AutoCAD"
                              >
                                <FileText className="h-3 w-3" />
                                <span>DXF</span>
                              </button>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              <strong>CAD Formats:</strong> SVG (vector), DXF (AutoCAD)
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">QR Code</label>
                    <div className="flex items-center space-x-2">
                          <QrCode className="h-4 w-4 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400 text-sm">No QR code generated yet</p>
                    </div>
                  </div>
                    );
                  })()}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manufacturer</label>
                    <div className="flex items-center space-x-2">
                      <Factory className="h-4 w-4 text-gray-400" />
                      <p className="text-gray-900 dark:text-white text-sm">
                        {selectedProduct.manufacturer}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Certifications</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.certifications.map((cert, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        >
                          {cert}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Specifications */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Technical Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Material</label>
                    <p className="text-gray-900 dark:text-white">{selectedProduct.specifications.material}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dimensions</label>
                    <p className="text-gray-900 dark:text-white">{selectedProduct.specifications.dimensions}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight</label>
                    <p className="text-gray-900 dark:text-white">{selectedProduct.specifications.weight}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grade</label>
                    <p className="text-gray-900 dark:text-white">{selectedProduct.specifications.grade}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Standard</label>
                    <p className="text-gray-900 dark:text-white">{selectedProduct.specifications.standard}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
                <div className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4">
                  <p className="text-gray-900 dark:text-white">{selectedProduct.description}</p>
                </div>
              </div>

              {/* Test Reports */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Test Reports</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedProduct.testReports.map((report, index) => (
                    <div key={index} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                      <p className="text-blue-800 dark:text-blue-200 font-medium">{report}</p>
                      <button className="text-blue-600 dark:text-blue-400 text-sm hover:underline mt-1">
                        View Report
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Edit Product Details
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                >
                  <option value="Rail Components">Rail Components</option>
                  <option value="Signaling Equipment">Signaling Equipment</option>
                  <option value="Fastening Systems">Fastening Systems</option>
                  <option value="Track Components">Track Components</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={editingProduct.status}
                  onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                >
                  <option value="manufactured">Manufactured</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="installed">Installed</option>
                  <option value="inspected">Inspected</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                <input
                  type="text"
                  value={editingProduct.location || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  onClick={handleSave}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 bg-gray-300 dark:bg-dark-600 hover:bg-gray-400 dark:hover:bg-dark-500 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Data Viewer Modal */}
      {viewingQRData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-800 rounded-xl max-w-6xl w.full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  QR Code Data - {viewingQRData.batchId}
                </h2>
                <button
                  onClick={() => setViewingQRData(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {viewingQRData.batchDetails ? (
                <>
                  {/* Basic Information Table */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <Factory className="h-5 w-5 mr-2 text-blue-600" />
                      Basic Information
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                        <tbody>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Batch Number</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.basicInfo.batchNumber}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Product Name</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.basicInfo.productName}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Category</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.basicInfo.category}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Manufacturing Date</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.basicInfo.manufacturingDate}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Batch Size</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.basicInfo.batchSize} units</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Manufacturer</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.basicInfo.manufacturer}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Location</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.basicInfo.location}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Quality Control Table */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                      Quality Control Data
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                        <tbody>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Grade</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.qualityControl.grade}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Test Results</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.qualityControl.testResults}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Inspector</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.qualityControl.inspector}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Certification Number</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.qualityControl.certificationNumber}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Compliance Standards</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.qualityControl.compliance}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Technical Specifications Table */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <Hash className="h-5 w-5 mr-2 text-purple-600" />
                      Technical Specifications
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                        <tbody>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Material</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.specifications.material}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Tensile Strength</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.specifications.tensileStrength}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Yield Strength</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.specifications.yieldStrength}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Elongation</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.specifications.elongation}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Hardness</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.specifications.hardness}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Chemical Composition</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.specifications.chemicalComposition}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Supply Chain Table */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <MapPin className="h-5 w-5 mr-2 text-orange-600" />
                      Supply Chain Information
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                        <tbody>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Raw Material Source</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.supplyChain.rawMaterialSource}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Transport Mode</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.supplyChain.transportMode}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Delivery Date</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.supplyChain.deliveryDate}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Destination Division</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.supplyChain.destinationDivision}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Tracking Number</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.supplyChain.trackingNumber}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Handled By</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.supplyChain.handledBy}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Approval & Certification Table */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                      Approval & Certification
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                        <tbody>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Approved By</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.approval.approvedBy}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Approval Date</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.approval.approvalDate}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Approval Number</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.approval.approvalNumber}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Digital Signature</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.approval.digitalSignature}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Approval Status</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm">Approved</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Installation Data Table */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-red-600" />
                      Installation & Maintenance
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                        <tbody>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Planned Installation</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.installation.plannedInstallation}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Installation Team</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.installation.installationTeam}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Estimated Install Date</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.installation.estimatedInstallDate}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Maintenance Schedule</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.installation.maintenanceSchedule}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-700">
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Warranty Period</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.installation.warrantyPeriod}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium">Replacement Cycle</td>
                            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{viewingQRData.batchDetails.installation.replacementCycle}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No detailed batch data available for this QR code</p>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start space-x-3">
                  <QrCode className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800 dark:text-blue-200">QR Code Information</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      When this QR code is scanned using any QR scanner app, all the above data will be displayed in a structured format. 
                      This includes complete batch information, quality control data, technical specifications, supply chain details, 
                      approval information, and installation plans.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Barcode Zoom Modal */}
      {zoomBarcode && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setZoomBarcode(null)}>
          <div className="bg-white rounded-xl p-4 max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Barcode Preview</h3>
              <button onClick={() => setZoomBarcode(null)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="border border-gray-300 rounded-lg p-4 bg-white">
              <img src={zoomBarcode} alt="Zoomed Barcode" className="w-full h-auto object-contain" />
            </div>
            <p className="text-xs text-gray-500 mt-2">Tip: Increase screen brightness for better scanning.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetails;