#include "kernel/types.h"
#include "user/user.h"

int
main(void)
{
  printf("Hello from my xv6 program!\n");
  printf("reported pid=%d\n", getpid());
  exit(0);
}
