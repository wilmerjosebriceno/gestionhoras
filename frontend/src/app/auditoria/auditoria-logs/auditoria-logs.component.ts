import { Component, OnInit } from '@angular/core';
import { AuditoriaService } from '../../core/services/auditoria.service';
import { LogEntry, QueryLog, ResumenAuditoria } from '../../core/models/log.model';

@Component({
  selector: 'app-auditoria-logs',
  standalone: false,
  templateUrl: './auditoria-logs.component.html',
})
export class AuditoriaLogsComponent implements OnInit {
  logs: LogEntry[] = [];
  filtros: QueryLog = {};
  resumen?: ResumenAuditoria;
  loading = false;
  private timeout: ReturnType<typeof setTimeout> | undefined;

  constructor(private service: AuditoriaService) {}

  ngOnInit(): void {
    this.service.getResumen().subscribe((r) => (this.resumen = r));
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.service.findAll(this.filtros).subscribe({
      next: (r) => { this.logs = r.data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  isLoading(): boolean {
    return this.loading && this.logs.length === 0;
  }

  buscar(): void {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.cargar(), 300);
  }
}
