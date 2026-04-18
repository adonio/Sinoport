import { Navigate, useParams } from 'react-router-dom';

import { CountingPanel, InboundFlightAppShell, useInboundStorage } from 'pages/mobile/inbound-shared';
import { useGetMobileInboundDetail } from 'api/station';

export default function MobileInboundBreakdownPage() {
  const { flightNo } = useParams();
  const { mobileInboundFlightDetail, mobileInboundFlightDetailLoading } = useGetMobileInboundDetail(flightNo);
  const { taskMap, setTaskMap } = useInboundStorage(flightNo);
  const flight = mobileInboundFlightDetail?.flight || null;
  const waybills = mobileInboundFlightDetail?.waybills || [];

  if (mobileInboundFlightDetailLoading) {
    return null;
  }

  if (!flight) {
    return <Navigate to="/mobile/inbound" replace />;
  }

  return (
    <InboundFlightAppShell flight={flight} waybills={waybills} taskMap={taskMap} showHero={false}>
      <CountingPanel flightNo={flight.flightNo} waybills={waybills} taskMap={taskMap} setTaskMap={setTaskMap} />
    </InboundFlightAppShell>
  );
}
