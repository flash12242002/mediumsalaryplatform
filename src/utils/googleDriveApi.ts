export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  webViewLink?: string;
}

// Format size helper
export function formatBytes(bytes?: string | number): string {
  if (!bytes) return "未知大小";
  const num = Number(bytes);
  if (isNaN(num)) return "未知大小";
  if (num === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return parseFloat((num / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// 1. List files in Google Drive
export async function listDriveFiles(token: string, folderId?: string): Promise<DriveFile[]> {
  let query = "trashed = false";
  if (folderId) {
    query += ` and '${folderId}' in parents`;
  }
  
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&fields=files(id, name, mimeType, size, createdTime, webViewLink)&pageSize=50`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`無法讀取 Google 雲端硬碟檔案: ${errorText}`);
  }

  const data = await response.json();
  return data.files || [];
}

// 2. Find folder ID by name
export async function findFolderId(token: string, folderName: string): Promise<string | null> {
  const query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) return null;
  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

// 3. Create folder
export async function createFolder(token: string, folderName: string, parentFolderId?: string): Promise<string> {
  const url = "https://www.googleapis.com/drive/v3/files";
  const body: any = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder"
  };
  if (parentFolderId) {
    body.parents = [parentFolderId];
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`無法建立資料夾: ${errorText}`);
  }

  const data = await response.json();
  return data.id;
}

// 4. Find or Create folder
export async function findOrCreateFolder(token: string, folderName: string): Promise<string> {
  let folderId = await findFolderId(token, folderName);
  if (!folderId) {
    folderId = await createFolder(token, folderName);
  }
  return folderId;
}

// 5. Upload File (Two-Step Meta + Content Upload)
export async function uploadFileToDrive(
  token: string, 
  filename: string, 
  mimeType: string, 
  content: string | Blob, 
  parentFolderId?: string
): Promise<DriveFile> {
  // Step A: Create metadata with optional parent folder ID
  const metaUrl = "https://www.googleapis.com/drive/v3/files";
  const metaBody: any = {
    name: filename,
    mimeType: mimeType
  };
  if (parentFolderId) {
    metaBody.parents = [parentFolderId];
  }

  const metaResponse = await fetch(metaUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(metaBody)
  });

  if (!metaResponse.ok) {
    const errorText = await metaResponse.text();
    throw new Error(`建立檔案中繼資料失敗: ${errorText}`);
  }

  const fileMeta = await metaResponse.json();
  const fileId = fileMeta.id;

  // Step B: Upload file media payload
  const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  
  const uploadResponse = await fetch(uploadUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": mimeType
    },
    body: content
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`上傳檔案內容失敗: ${errorText}`);
  }

  // Fetch full details of uploaded file to get webViewLink and size
  const detailsUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,webViewLink`;
  const detailsResponse = await fetch(detailsUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!detailsResponse.ok) {
    return {
      id: fileId,
      name: filename,
      mimeType: mimeType,
      createdTime: new Date().toISOString()
    };
  }

  return await detailsResponse.json();
}

// 6. Delete File
export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`無法刪除 Google 雲端硬碟檔案: ${errorText}`);
  }
}
