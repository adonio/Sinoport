import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Stack from '@mui/material/Stack';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { demoPermissionMatrixRows, importJobRows, interfaceGovernanceRows, masterDataRows, nonFunctionalDemoRows } from 'data/sinoport-adapters';

export default function PlatformMasterDataPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Master Data & Integration"
          title="主数据与接口治理"
          description="当前阶段只做前端 demo，但平台侧必须先把主键规则、接口状态、导入日志和失败重试口径展示清楚。"
          chips={['Flight/AWB/Truck/Event Keys', 'Import Logs', 'Sync Status', 'Retry Strategy']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/master-data/sync" variant="outlined">
                同步看板
              </Button>
              <Button component={RouterLink} to="/platform/master-data/jobs" variant="outlined">
                导入任务
              </Button>
              <Button component={RouterLink} to="/platform/master-data/relationships" variant="outlined">
                对象关系
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 5 }}>
        <MainCard title="主数据口径">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>对象</TableCell>
                <TableCell>主键规则</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {masterDataRows.map((item) => (
                <TableRow key={item.object} hover>
                  <TableCell>{item.object}</TableCell>
                  <TableCell>{item.keyRule}</TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell>
                    <StatusChip label={item.readiness} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title="接口治理视图">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>接口</TableCell>
                <TableCell>方式</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>关联对象</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>兜底策略</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {interfaceGovernanceRows.map((item) => (
                <TableRow key={item.name} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.method}</TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell>{item.linkedObject}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                  <TableCell>{item.fallback}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title="模拟导入与同步日志">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>导入批次</TableCell>
                <TableCell>来源</TableCell>
                <TableCell>关联对象</TableCell>
                <TableCell>结果</TableCell>
                <TableCell>摘要</TableCell>
                <TableCell>重试策略</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {importJobRows.map((item) => (
                <TableRow key={item.jobId} hover>
                  <TableCell>{item.jobId}</TableCell>
                  <TableCell>{item.source}</TableCell>
                  <TableCell>{item.linkedTo}</TableCell>
                  <TableCell>
                    <StatusChip label={item.result} />
                  </TableCell>
                  <TableCell>{item.summary}</TableCell>
                  <TableCell>{item.retry}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title="Demo 权限矩阵">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>范围</TableCell>
                <TableCell>角色</TableCell>
                <TableCell>可见模块</TableCell>
                <TableCell>可执行动作</TableCell>
                <TableCell>说明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {demoPermissionMatrixRows.map((item) => (
                <TableRow key={`${item.scope}-${item.role}`} hover>
                  <TableCell>{item.scope}</TableCell>
                  <TableCell>{item.role}</TableCell>
                  <TableCell>{item.visible}</TableCell>
                  <TableCell>{item.controls}</TableCell>
                  <TableCell>{item.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title="非功能要求前端占位">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>类别</TableCell>
                <TableCell>PRD 目标</TableCell>
                <TableCell>当前 demo 口径</TableCell>
                <TableCell>说明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {nonFunctionalDemoRows.map((item) => (
                <TableRow key={item.category} hover>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.target}</TableCell>
                  <TableCell>{item.currentDemo}</TableCell>
                  <TableCell>{item.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
