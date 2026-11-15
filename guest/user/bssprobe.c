#include "kernel/types.h"
#include "user/user.h"

// This native ELF has a real NOBITS region, rather than a browser link slot.
static volatile unsigned char zeroes[4096];

int
main(void)
{
  printf("BSS byte=%d\n", zeroes[0]);
  exit(0);
}
