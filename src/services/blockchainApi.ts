// Use environment-based API URL for deployment
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Enhanced error handling and response validation
interface ApiResponse<T = any> {
	ok: boolean;
	data?: T;
	error?: string;
	txHash?: string;
	batchId?: string;
	qrCode?: any;
	qrCodes?: any[];
	products?: any[];
}

// Generic API call wrapper with error handling
async function apiCall<T = any>(
	endpoint: string,
	options: RequestInit = {}
): Promise<ApiResponse<T>> {
	try {
		const res = await fetch(`${API_BASE}${endpoint}`, {
			headers: { 'Content-Type': 'application/json' },
			...options
		});

		if (!res.ok) {
			return {
				ok: false,
				error: `HTTP ${res.status}: ${res.statusText}`
			};
		}

		const text = await res.text();
		if (!text) {
			return {
				ok: false,
				error: 'Empty response from server'
			};
		}

		const data = JSON.parse(text);
		
		// Validate response structure
		if (typeof data.ok !== 'boolean') {
			return {
				ok: false,
				error: 'Invalid response format from server'
			};
		}

		return data;
	} catch (error) {
		console.error(`API call failed for ${endpoint}:`, error);
		return {
			ok: false,
			error: error instanceof Error ? error.message : 'Network error'
		};
	}
}

export async function apiCreateProduct(payload: {
	name: string;
	category: string;
	quantity: number;
	urgency: string;
	section: string;
	budget: number;
	requiredBy: string;
	justification: string;
}): Promise<ApiResponse> {
	// Validate required fields
	const requiredFields = ['name', 'category', 'quantity', 'urgency', 'section', 'budget', 'requiredBy', 'justification'];
	const missingFields = requiredFields.filter(field => !payload[field as keyof typeof payload]);
	
	if (missingFields.length > 0) {
		return {
			ok: false,
			error: `Missing required fields: ${missingFields.join(', ')}`
		};
	}

	// Validate data types
	if (typeof payload.quantity !== 'number' || payload.quantity <= 0) {
		return {
			ok: false,
			error: 'Quantity must be a positive number'
		};
	}

	if (typeof payload.budget !== 'number' || payload.budget < 0) {
		return {
			ok: false,
			error: 'Budget must be a non-negative number'
		};
	}

	console.log('Creating product on blockchain:', payload);
	return apiCall('/createProduct', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function apiUpdateProduct(payload: { id: number; status: string }): Promise<ApiResponse> {
	// Validate required fields
	if (!payload.id || typeof payload.id !== 'number') {
		return {
			ok: false,
			error: 'Product ID must be a valid number'
		};
	}

	if (!payload.status || typeof payload.status !== 'string') {
		return {
			ok: false,
			error: 'Status must be a valid string'
		};
	}

	console.log('Updating product status on blockchain:', payload);
	return apiCall('/updateProduct', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function apiApproveProduct(payload: { id: number }): Promise<ApiResponse> {
	// Validate required fields
	if (!payload.id || typeof payload.id !== 'number') {
		return {
			ok: false,
			error: 'Product ID must be a valid number'
		};
	}

	console.log('Approving product on blockchain:', payload);
	return apiCall('/approveProduct', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function apiGetProducts(): Promise<ApiResponse> {
	console.log('Fetching products from blockchain...');
	return apiCall('/getProducts');
}

export async function apiGetQRCode(batchId: string): Promise<ApiResponse> {
	if (!batchId || typeof batchId !== 'string') {
		return {
			ok: false,
			error: 'Batch ID must be a valid string'
		};
	}

	console.log('Fetching QR code for batch:', batchId);
	return apiCall(`/getQRCode/${batchId}`);
}

export async function apiGetAllQRCodes(): Promise<ApiResponse> {
	console.log('Fetching all QR codes from blockchain...');
	return apiCall('/getAllQRCodes');
}

export async function apiGenerateQR(payload: {
	productId: string;
	productName: string;
	category: string;
	manufacturerId: string;
}): Promise<ApiResponse> {
	// Validate required fields
	const requiredFields = ['productId', 'productName', 'category', 'manufacturerId'];
	const missingFields = requiredFields.filter(field => !payload[field as keyof typeof payload]);
	
	if (missingFields.length > 0) {
		return {
			ok: false,
			error: `Missing required fields: ${missingFields.join(', ')}`
		};
	}

	console.log('Generating QR code:', payload);
	return apiCall('/generateQR', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

// Additional utility functions for blockchain integration
export async function apiLookupBarcode(barcodeCode: string): Promise<ApiResponse> {
	if (!barcodeCode || typeof barcodeCode !== 'string') {
		return {
			ok: false,
			error: 'Barcode code must be a valid string'
		};
	}

	console.log('Looking up barcode:', barcodeCode);
	return apiCall(`/lookupBarcode/${encodeURIComponent(barcodeCode)}`);
}

export async function apiGenerateTestQRCodes(): Promise<ApiResponse> {
	console.log('Generating test QR codes...');
	return apiCall('/generateTestQRCodes', {
		method: 'POST'
	});
}

// Lifecycle management functions
export async function apiMarkAsManufactured(payload: { id: number; manufacturingLocation: string }): Promise<ApiResponse> {
	if (!payload.id || typeof payload.id !== 'number') {
		return {
			ok: false,
			error: 'Product ID must be a valid number'
		};
	}

	if (!payload.manufacturingLocation || typeof payload.manufacturingLocation !== 'string') {
		return {
			ok: false,
			error: 'Manufacturing location must be a valid string'
		};
	}

	console.log('Marking product as manufactured on blockchain:', payload);
	return apiCall('/markAsManufactured', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function apiMarkAsDelivered(payload: { id: number; trackingNumber: string }): Promise<ApiResponse> {
	if (!payload.id || typeof payload.id !== 'number') {
		return {
			ok: false,
			error: 'Product ID must be a valid number'
		};
	}

	if (!payload.trackingNumber || typeof payload.trackingNumber !== 'string') {
		return {
			ok: false,
			error: 'Tracking number must be a valid string'
		};
	}

	console.log('Marking product as delivered on blockchain:', payload);
	return apiCall('/markAsDelivered', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function apiMarkAsInstalled(payload: { id: number; installationLocation: string }): Promise<ApiResponse> {
	if (!payload.id || typeof payload.id !== 'number') {
		return {
			ok: false,
			error: 'Product ID must be a valid number'
		};
	}

	if (!payload.installationLocation || typeof payload.installationLocation !== 'string') {
		return {
			ok: false,
			error: 'Installation location must be a valid string'
		};
	}

	console.log('Marking product as installed on blockchain:', payload);
	return apiCall('/markAsInstalled', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

// Blockchain status checking utility
export async function checkBlockchainStatus(): Promise<{ connected: boolean; error?: string }> {
	try {
		const response = await apiGetProducts();
		return {
			connected: response.ok,
			error: response.ok ? undefined : response.error
		};
	} catch (error) {
		return {
			connected: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}


