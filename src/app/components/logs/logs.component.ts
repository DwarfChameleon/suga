import { Component, OnInit } from '@angular/core';
import { AppLogService, AppLogEntry } from 'src/app/services/app-log.service';
import { UiFeedbackService } from 'src/app/services/ui-feedback.service';

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss']
})
export class LogsComponent implements OnInit {
  logs: AppLogEntry[] = [];
  filterLevel: 'all' | 'info' | 'warn' | 'error' = 'all';
  search = '';

  constructor(private appLog: AppLogService, private uiFeedback: UiFeedbackService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.logs = this.appLog.getAll();
  }

  clearLogs(): void {
    this.appLog.clear();
    this.refresh();
    this.uiFeedback.success('Logs cleared.');
  }

  copyLogs(): void {
    try {
      const text = this.appLog.exportJson();
      navigator.clipboard.writeText(text);
      this.uiFeedback.success('Logs copied.');
    } catch {
      this.uiFeedback.error('Copy failed.');
    }
  }

  filteredLogs(): AppLogEntry[] {
    const query = this.search.toLowerCase();
    return this.logs.filter((log) => {
      if (this.filterLevel !== 'all' && log.level !== this.filterLevel) return false;
      if (!query) return true;
      const haystack = [
        log.message,
        log.stack,
        log.url,
        JSON.stringify(log.context || {})
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }
}
