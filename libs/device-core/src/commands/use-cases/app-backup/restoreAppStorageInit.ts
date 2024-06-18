import Transport, { StatusCodes, TransportStatusError } from "@ledgerhq/hw-transport";
import { LocalTracer } from "@ledgerhq/logs";
import type { APDU } from "../../entities/APDU";

/**
 * Name in documentation: INS_APP_STORAGE_RESTORE_INIT
 * cla: 0xe0
 * ins: 0x6c
 * p1: 0x00
 * p2: 0x00
 * data:
 *  - LC: BACKUP_LEN_LEN (=0x04) + APP_NAME_LEN (1 byte)
 *  - DATA: BACKUP_LEN + APP_NAME
 *
 * For example, the 'bitcoin' app with backup of length 0x00007000:
 *    1. LC is 0x0b
 *    2. DATA is 0x00007000 0x626974636f696e
 */
const RESTORE_APP_STORAGE_INIT: APDU = [0xe0, 0x6c, 0x00, 0x00, undefined];

/**
 * 0x9000: Success.
 * 0x5123: Application not found.
 * 0x662F: Invalid device state, recovery mode.
 * 0x5501: Invalid consent, user rejected.
 * 0x5502: Invalid consent, pin is not set.
 * 0x670A: Invalid application name length, two chars minimum.
 * 0x6733: Invalid BACKUP_LEN value.
 */
const RESPONSE_STATUS_SET: number[] = [
  StatusCodes.OK,
  StatusCodes.APP_NOT_FOUND_OR_INVALID_CONTEXT,
  StatusCodes.CUSTOM_IMAGE_BOOTLOADER,
  StatusCodes.USER_REFUSED_ON_DEVICE,
  StatusCodes.PIN_NOT_SET,
  StatusCodes.INVALID_APP_NAME_LEN,
  StatusCodes.INVALID_BACKUP_LEN,
];

/**
 * Restores the application storage initialization.
 *
 * @param transport - The transport object used for communication with the device.
 * @param appName - The name of the application to restore the storage for.
 * @param backupSize - The size of the backup to restore.
 * @returns A promise that resolves to a string representing the parsed response.
 * @throws {TransportStatusError} If the response status is invalid.
 */
export async function restoreAppStorageInit(
  transport: Transport,
  appName: string,
  backupSize: number,
): Promise<void> {
  const tracer = new LocalTracer("hw", {
    transport: transport.getTraceContext(),
    function: "restoreAppStorageInit",
  });
  tracer.trace("Start");

  const params: Buffer = Buffer.concat([
    Buffer.from([appName.length + 4]), // LC
    Buffer.from(backupSize.toString(16).padStart(8, "0"), "hex"), // BACKUP_LEN
    Buffer.from(appName, "ascii"), // APP_NAME
  ]);
  RESTORE_APP_STORAGE_INIT[4] = params;

  const response = await transport.send(...RESTORE_APP_STORAGE_INIT, RESPONSE_STATUS_SET);
  parseResponse(response);
}

export function parseResponse(data: Buffer): void {
  const tracer = new LocalTracer("hw", {
    function: "parseResponse@restoreAppStorageInit",
  });
  const status = data.readUInt16BE(data.length - 2);
  if (tracer) {
    tracer.trace("Result status from 0xe06c0000", { status });
  }

  if (status === StatusCodes.OK) {
    return;
  }

  throw new TransportStatusError(status);
}
