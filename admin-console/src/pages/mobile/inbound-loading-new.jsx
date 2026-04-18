import { Navigate, useParams } from 'react-router-dom';

import { useGetMobileInboundDetail } from 'api/station';

export default function MobileInboundLoadingNewPage() {
  const { flightNo } = useParams();
  const { mobileInboundFlightDetail, mobileInboundFlightDetailLoading } = useGetMobileInboundDetail(flightNo);
  const flight = mobileInboundFlightDetail?.flight || null;

  if (mobileInboundFlightDetailLoading) {
    return null;
  }

  if (!flight) {
    return <Navigate to="/mobile/inbound" replace />;
  }

  return <Navigate to={`/mobile/inbound/${flight.flightNo}/loading`} replace />;
}
