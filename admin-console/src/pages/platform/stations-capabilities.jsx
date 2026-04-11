import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import CheckOutlined from '@ant-design/icons/CheckOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { platformStationCapabilityRows, stationCapabilityColumns } from 'data/sinoport-adapters';
import { Link as RouterLink } from 'react-router-dom';

function renderCapabilitySymbol(status) {
  if (status === 'yes') {
    return <CheckOutlined style={{ color: '#1677ff', fontSize: 18 }} />;
  }
  if (status === 'building') {
    return <ClockCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />;
  }
  return <CloseOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />;
}

export default function PlatformStationsCapabilitiesPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station Capability Matrix"
          title="货站能力矩阵"
          description="以站点能力、SLA、控制深度和当前风险为主视角展示平台侧的货站能力矩阵。"
          chips={['Capabilities', 'SLA', 'Control Level', 'Readiness']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/stations" variant="outlined">
                返回站点总览
              </Button>
              <Button component={RouterLink} to="/platform/stations/teams" variant="outlined">
                班组映射
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title="站点能力矩阵">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>站点</TableCell>
                <TableCell>区域</TableCell>
              <TableCell>控制层级</TableCell>
                <TableCell>阶段</TableCell>
                <TableCell>SLA</TableCell>
                {stationCapabilityColumns.map((column) => (
                  <TableCell key={column.key} align="center">
                    {column.label}
                  </TableCell>
                ))}
                <TableCell>当前风险</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {platformStationCapabilityRows.map((item) => (
                <TableRow key={item.code} hover>
                  <TableCell>
                    <Button component={RouterLink} to={`/platform/stations/${item.code}`} size="small" variant="text">
                      {item.code}
                    </Button>
                  </TableCell>
                  <TableCell>{item.region}</TableCell>
                  <TableCell><StatusChip label={item.control} /></TableCell>
                  <TableCell><StatusChip label={item.phase} /></TableCell>
                  <TableCell>{item.promise}</TableCell>
                  {stationCapabilityColumns.map((column) => (
                    <TableCell key={`${item.code}-${column.key}`} align="center">
                      {renderCapabilitySymbol(item.capabilityMatrix[column.key])}
                    </TableCell>
                  ))}
                  <TableCell>{item.risk}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title="符号说明">
          <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap' }}>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              {renderCapabilitySymbol('yes')}
              <Typography variant="body2">有</Typography>
            </Stack>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              {renderCapabilitySymbol('no')}
              <Typography variant="body2">无</Typography>
            </Stack>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              {renderCapabilitySymbol('building')}
              <Typography variant="body2">建设中</Typography>
            </Stack>
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
