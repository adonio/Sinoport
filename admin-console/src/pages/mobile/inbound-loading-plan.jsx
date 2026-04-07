import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { LoadingExecutionPanel, useInboundLoadingStorage, useInboundStorage } from 'pages/mobile/inbound-shared';

export default function MobileInboundLoadingPlanPage() {
  const navigate = useNavigate();
  const { flightNo, planId } = useParams();
  const { loadingPlans, setLoadingPlans } = useInboundLoadingStorage();
  const { pallets, setPallets } = useInboundStorage();

  const plan = loadingPlans.find((item) => item.id === planId && item.flightNo === flightNo);

  if (!plan) {
    return <Navigate to={`/mobile/inbound/${flightNo}/loading`} replace />;
  }

  return (
    <LoadingExecutionPanel
      flightNo={flightNo}
      plan={plan}
      pallets={pallets}
      setPallets={setPallets}
      setLoadingPlans={setLoadingPlans}
      onCompleted={() => navigate(`/mobile/inbound/${flightNo}/loading`, { replace: true })}
    />
  );
}
