export function buildStationCopilotUrl(objectType = 'station', objectKey = 'MME') {
  const params = new URLSearchParams();
  params.set('object_type', objectType);

  if (objectKey) {
    params.set('object_key', objectKey);
  }

  return `/station/copilot?${params.toString()}`;
}

export function buildStationObjectDetailUrl(objectType = 'station', objectKey = '') {
  if (objectType === 'Flight') {
    return objectKey ? `/station/inbound/flights/${encodeURIComponent(objectKey)}` : '/station/inbound/flights';
  }

  if (objectType === 'AWB') {
    return objectKey ? `/station/inbound/waybills/${encodeURIComponent(objectKey)}` : '/station/inbound/waybills';
  }

  if (objectType === 'Shipment') {
    return objectKey ? `/station/shipments/${encodeURIComponent(objectKey)}` : '/station/shipments';
  }

  if (objectType === 'Exception') {
    return objectKey ? `/station/exceptions/${encodeURIComponent(objectKey)}` : '/station/exceptions';
  }

  return '/station/dashboard';
}

export function buildStationObjectLabel(objectType = 'station', objectKey = '') {
  if (objectType === 'station') return objectKey || 'MME';
  return `${objectType} / ${objectKey || '--'}`;
}
