import { Navigate, useParams } from 'react-router-dom';

import { CountingPanel } from 'pages/mobile/inbound-shared';
import { buildOutboundWaybills, getOutboundFlight, OutboundFlightAppShell, useOutboundStorage } from 'pages/mobile/outbound-shared';

export default function MobileOutboundCountingPage() {
  const { flightNo } = useParams();
  const flight = getOutboundFlight(flightNo);
  const { receiptMap, setReceiptMap } = useOutboundStorage(flightNo);

  if (!flight) {
    return <Navigate to="/mobile/outbound" replace />;
  }

  const waybills = buildOutboundWaybills(flight.flightNo);
  const taskMap = Object.fromEntries(
    waybills.map((item) => {
      const receipt = receiptMap[item.awb];
      const countedBoxes = Number(receipt?.receivedPieces ?? 0);
      const status = receipt?.status === '已复核' ? '理货完成' : countedBoxes > 0 ? '点货中' : '未开始';
      return [
        item.awb,
        {
          countedBoxes,
          actualWeight: Number(receipt?.reviewedWeight ?? receipt?.receivedWeight ?? 0),
          status,
          updatedAt: receipt?.reviewedAt || receipt?.receivedAt || null,
          scannedSerials: [],
          lastScanRaw: '',
          lastScanAt: null
        }
      ];
    })
  );

  const setTaskMap = (updater) => {
    const next = typeof updater === 'function' ? updater(taskMap) : updater;
    setReceiptMap((prev) => {
      const nextReceiptMap = { ...prev };
      Object.entries(next || {}).forEach(([awbNo, value]) => {
        nextReceiptMap[awbNo] = {
          ...(prev[awbNo] || {}),
          awb: awbNo,
          flightNo: flight.flightNo,
          receivedPieces: Number(value?.countedBoxes ?? 0),
          receivedWeight: Number(value?.actualWeight ?? prev[awbNo]?.receivedWeight ?? 0),
          reviewedWeight: Number(value?.actualWeight ?? prev[awbNo]?.reviewedWeight ?? 0),
          status: value?.status === '理货完成' ? '已复核' : Number(value?.countedBoxes ?? 0) > 0 ? '已收货' : '待收货',
          reviewStatus: value?.status === '理货完成' ? '已复核' : '待复核',
          reviewedAt: value?.status === '理货完成' ? new Date().toISOString() : prev[awbNo]?.reviewedAt || null,
          archived: false
        };
      });
      return nextReceiptMap;
    });
  };

  return (
    <OutboundFlightAppShell flight={flight} showHero={false}>
      <CountingPanel flightNo={flight.flightNo} waybills={waybills} taskMap={taskMap} setTaskMap={setTaskMap} />
    </OutboundFlightAppShell>
  );
}
