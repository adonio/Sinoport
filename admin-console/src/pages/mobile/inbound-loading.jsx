import { Navigate, useParams } from 'react-router-dom';

import { InboundFlightAppShell, LoadingPanel, useInboundLoadingStorage, useInboundStorage } from 'pages/mobile/inbound-shared';
import { useGetMobileInboundDetail } from 'api/station';

export default function MobileInboundLoadingPage() {
  const { flightNo } = useParams();
  const { mobileInboundFlightDetail, mobileInboundFlightDetailLoading } = useGetMobileInboundDetail(flightNo);
  const { taskMap } = useInboundStorage(flightNo);
  const { loadingPlans, setLoadingPlans } = useInboundLoadingStorage(flightNo);
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
      <LoadingPanel flightNo={flight.flightNo} loadingPlans={loadingPlans} setLoadingPlans={setLoadingPlans} />
    </InboundFlightAppShell>
  );
}
