import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'sgh_id' })
export class SghId {
  @PrimaryColumn({ name: 'prefijo', type: 'varchar', length: 10 })
  prefijo: string;

  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;
}
