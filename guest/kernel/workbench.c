// Native instruction bridges for the browser C compiler, which cannot assemble
// RISC-V inline assembly. These execute the same primitives as riscv.h.
#include "types.h"
#include "riscv.h"

void wb_fence(void) { __sync_synchronize(); }
uint wb_test_and_set(volatile uint *p, uint value) {
  return __sync_lock_test_and_set(p, value);
}
void wb_lock_release(volatile uint *p) { __sync_lock_release(p); }

uint64 wb_r_satp(void) { return r_satp(); }
uint64 wb_r_sstatus(void) { return r_sstatus(); }
uint64 wb_r_scause(void) { return r_scause(); }
uint64 wb_r_sepc(void) { return r_sepc(); }
uint64 wb_r_stvec(void) { return r_stvec(); }
uint64 wb_r_sie(void) { return r_sie(); }
uint64 wb_r_stval(void) { return r_stval(); }
void wb_intr_on(void) { intr_on(); }
void wb_intr_off(void) { intr_off(); }
int wb_intr_get(void) { return intr_get(); }
