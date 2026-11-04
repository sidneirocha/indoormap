const TAB_MAPS = 'MAPAS';
const TAB_LOCAIS = 'LOCAIS';
const TAB_ASSETS = 'ARQUIVOS';
const PROP_SPREADSHEET_ID = 'SPREADSHEET_ID';
const PROP_DRIVE_FOLDER_ID = 'DRIVE_FOLDER_ID';
const PROP_EDITOR_KEY = 'EDITOR_KEY';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Mapa Interativo')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function setupDatabase() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty(PROP_SPREADSHEET_ID);
  let folderId = props.getProperty(PROP_DRIVE_FOLDER_ID);
  let spreadsheet;
  let folder;

  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create('Banco de Mapas Interativos');
    spreadsheetId = spreadsheet.getId();
    props.setProperty(PROP_SPREADSHEET_ID, spreadsheetId);
  }

  if (folderId) {
    folder = DriveApp.getFolderById(folderId);
  } else {
    folder = DriveApp.createFolder('Arquivos dos Mapas Interativos');
    folderId = folder.getId();
    props.setProperty(PROP_DRIVE_FOLDER_ID, folderId);
  }

  ensureSheet_(spreadsheet, TAB_MAPS, [
    'map_id', 'nome', 'descricao', 'imagem_file_id', 'imagem_url', 'largura', 'altura', 'status', 'criado_em', 'atualizado_em'
  ]);
  ensureSheet_(spreadsheet, TAB_LOCAIS, [
    'map_id', 'local_id', 'nome', 'categoria', 'tags', 'x_pct', 'y_pct', 'icone', 'cor', 'descricao', 'link', 'ordem', 'atualizado_em'
  ]);
  ensureSheet_(spreadsheet, TAB_ASSETS, [
    'map_id', 'asset_id', 'tipo', 'nome', 'file_id', 'url', 'mime_type', 'criado_em'
  ]);

  return {
    spreadsheetUrl: spreadsheet.getUrl(),
    folderUrl: folder.getUrl(),
    message: 'Planilha e pasta criadas. Configure EDITOR_KEY nas propriedades do script antes de publicar.'
  };
}

function getPublicMap(mapId) {
  mapId = cleanId_(mapId);
  if (!mapId) throw new Error('Informe o identificador do mapa.');
  const sheet = getSheet_(TAB_MAPS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  const index = headerIndex_(headers);
  const row = rows.find(r => String(r[index.map_id]) === mapId && String(r[index.status]).toLowerCase() !== 'private');
  if (!row) throw new Error('Mapa não encontrado ou ainda não publicado.');

  const map = {
    mapId: mapId,
    name: String(row[index.nome] || 'Mapa sem título'),
    description: String(row[index.descricao] || ''),
    imageFileId: String(row[index.imagem_file_id] || ''),
    imageUrl: String(row[index.imagem_url] || ''),
    imageWidth: Number(row[index.largura]) || 1600,
    imageHeight: Number(row[index.altura]) || 900,
    status: String(row[index.status] || 'public')
  };
  map.locations = getLocations_(mapId);
  return map;
}

function saveMap(map, editorKey) {
  assertEditorKey_(editorKey);
  if (!map || !String(map.name || '').trim()) throw new Error('Dê um nome ao mapa antes de salvar.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const spreadsheet = getSpreadsheet_();
    const mapsSheet = spreadsheet.getSheetByName(TAB_MAPS);
    const locationsSheet = spreadsheet.getSheetByName(TAB_LOCAIS);
    const now = new Date();
    const mapId = cleanId_(map.mapId) || createMapId_(map.name);
    let imageFileId = String(map.imageFileId || '');
    let imageUrl = String(map.imageUrl || '');
    let imageWidth = Math.max(1, Number(map.imageWidth) || 1600);
    let imageHeight = Math.max(1, Number(map.imageHeight) || 900);

    if (map.imageDataUrl) {
      const uploaded = saveImage_(map.imageDataUrl, mapId, String(map.imageFileName || 'mapa.jpg'));
      imageFileId = uploaded.fileId;
      imageUrl = uploaded.url;
      imageWidth = Math.max(1, Number(map.imageWidth) || uploaded.width || imageWidth);
      imageHeight = Math.max(1, Number(map.imageHeight) || uploaded.height || imageHeight);
      appendAsset_(mapId, uploaded.fileId, 'mapa', uploaded.fileName, uploaded.url, uploaded.mimeType);
    }

    if (!imageUrl) throw new Error('Envie uma imagem para o mapa antes de salvar.');

    const mapRows = mapsSheet.getDataRange().getValues();
    const mapHeaders = mapRows[0];
    const mi = headerIndex_(mapHeaders);
    const existingIndex = mapRows.findIndex((r, i) => i > 0 && String(r[mi.map_id]) === mapId);
    const createdAt = existingIndex > 0 ? mapRows[existingIndex][mi.criado_em] : now;
    const mapRow = [mapId, String(map.name).trim(), String(map.description || ''), imageFileId, imageUrl,
      imageWidth, imageHeight, 'public', createdAt || now, now];
    if (existingIndex > 0) mapsSheet.getRange(existingIndex + 1, 1, 1, mapRow.length).setValues([mapRow]);
    else mapsSheet.appendRow(mapRow);

    const oldRows = locationsSheet.getDataRange().getValues();
    const header = oldRows[0];
    const li = headerIndex_(header);
    for (let i = oldRows.length - 1; i >= 1; i--) {
      if (String(oldRows[i][li.map_id]) === mapId) locationsSheet.deleteRow(i + 1);
    }

    const locations = Array.isArray(map.locations) ? map.locations : [];
    if (locations.length > 0) {
      const values = locations.map((p, order) => [
        mapId,
        cleanId_(p.id) || Utilities.getUuid(),
        String(p.name || 'Local sem nome').trim().slice(0, 120),
        String(p.category || 'outros').slice(0, 40),
        String(p.tags || '').slice(0, 500),
        clamp_(p.x, 0, 100),
        clamp_(p.y, 0, 100),
        String(p.icon || '📍').slice(0, 16),
        String(p.color || '#2563eb').slice(0, 20),
        String(p.description || '').slice(0, 2000),
        safeUrl_(p.link),
        order,
        now
      ]);
      locationsSheet.getRange(locationsSheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
    }

    return getPublicMap(mapId);
  } finally {
    lock.releaseLock();
  }
}

function getAppUrl() {
  return ScriptApp.getService().getUrl();
}

function getLocations_(mapId) {
  const sheet = getSheet_(TAB_LOCAIS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const i = headerIndex_(rows.shift());
  return rows.filter(r => String(r[i.map_id]) === mapId).map(r => ({
    id: String(r[i.local_id] || ''),
    name: String(r[i.nome] || ''),
    category: String(r[i.categoria] || 'outros'),
    tags: String(r[i.tags] || ''),
    x: Number(r[i.x_pct]) || 0,
    y: Number(r[i.y_pct]) || 0,
    icon: String(r[i.icone] || '📍'),
    color: String(r[i.cor] || '#2563eb'),
    description: String(r[i.descricao] || ''),
    link: String(r[i.link] || '')
  }));
}

function saveImage_(dataUrl, mapId, originalName) {
  const match = String(dataUrl).match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Formato de imagem inválido. Use PNG, JPG ou WebP.');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('A imagem ultrapassa 8 MB após a compressão.');
  const mimeType = match[1];
  const extension = mimeType === 'image/png' ? 'png' : (mimeType === 'image/webp' ? 'webp' : 'jpg');
  const fileName = (mapId + '-' + Date.now() + '.' + extension).slice(0, 150);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty(PROP_DRIVE_FOLDER_ID));
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    fileId: file.getId(),
    fileName: file.getName(),
    mimeType: mimeType,
    width: 0,
    height: 0,
    url: 'https://drive.google.com/uc?export=view&id=' + file.getId()
  };
}

function appendAsset_(mapId, fileId, type, name, url, mimeType) {
  getSheet_(TAB_ASSETS).appendRow([mapId, Utilities.getUuid(), type, name, fileId, url, mimeType, new Date()]);
}

function assertEditorKey_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty(PROP_EDITOR_KEY);
  if (!expected) throw new Error('O administrador ainda não configurou EDITOR_KEY nas propriedades do Apps Script.');
  if (String(provided || '') !== expected) throw new Error('Chave de edição inválida.');
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_SPREADSHEET_ID);
  if (!id) throw new Error('Execute setupDatabase() no Apps Script antes de usar o gerador.');
  return SpreadsheetApp.openById(id);
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Aba ' + name + ' não encontrada. Execute setupDatabase().');
  return sheet;
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#eaf0ff');
    sheet.autoResizeColumns(1, headers.length);
  }
}

function headerIndex_(headers) {
  const out = {};
  headers.forEach((h, i) => out[String(h)] = i);
  return out;
}

function cleanId_(value) {
  return String(value || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 55);
}

function createMapId_(name) {
  const stem = cleanId_(name).slice(0, 36) || 'mapa';
  return stem + '-' + Utilities.getUuid().slice(0, 8);
}

function clamp_(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function safeUrl_(value) {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) ? url.slice(0, 1000) : '';
}
