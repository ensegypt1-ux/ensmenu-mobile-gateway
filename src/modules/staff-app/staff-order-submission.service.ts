import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';

export type StaffOrderSubmissionRecord = {
  menuId: number;
  staffCallId: number;
  submittedAt: string;
  submittedByStaffId: number;
  submittedByStaffName?: string;
};

type SubmissionStoreFile = {
  submissions: Record<string, StaffOrderSubmissionRecord>;
};

@Injectable()
export class StaffOrderSubmissionService implements OnModuleInit {
  private readonly logger = new Logger(StaffOrderSubmissionService.name);
  private readonly filePath: string;
  private store: SubmissionStoreFile = { submissions: {} };
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService
      .get<string>('STAFF_ORDER_SUBMISSIONS_FILE')
      ?.trim();
    this.filePath =
      configured && configured.length > 0
        ? configured
        : path.join(process.cwd(), 'data', 'staff-order-submissions.json');
  }

  async onModuleInit(): Promise<void> {
    await this.loadFromDisk();
  }

  private submissionKey(menuId: number, staffCallId: number): string {
    return `${menuId}:${staffCallId}`;
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as SubmissionStoreFile;
      if (parsed?.submissions && typeof parsed.submissions === 'object') {
        this.store = parsed;
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(`Failed to load submissions file: ${String(error)}`);
      }
    }
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.store, null, 2), 'utf8');
    await fs.rename(tmp, this.filePath);
  }

  private enqueuePersist(): Promise<void> {
    this.writeChain = this.writeChain
      .then(() => this.persist())
      .catch((error) => {
        this.logger.error(`Failed to persist submissions: ${String(error)}`);
      });
    return this.writeChain;
  }

  get(menuId: number, staffCallId: number): StaffOrderSubmissionRecord | null {
    return (
      this.store.submissions[this.submissionKey(menuId, staffCallId)] ?? null
    );
  }

  isSubmitted(menuId: number, staffCallId: number): boolean {
    return this.get(menuId, staffCallId) != null;
  }

  async recordSubmission(
    record: StaffOrderSubmissionRecord,
  ): Promise<StaffOrderSubmissionRecord> {
    const key = this.submissionKey(record.menuId, record.staffCallId);
    if (this.store.submissions[key]) {
      throw new Error('ALREADY_SUBMITTED');
    }
    this.store.submissions[key] = record;
    await this.enqueuePersist();
    return record;
  }

  listForMenu(menuId: number): StaffOrderSubmissionRecord[] {
    const prefix = `${menuId}:`;
    return Object.entries(this.store.submissions)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => value);
  }
}
