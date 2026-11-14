#include <stdio.h>
#include <stddef.h>
#include "kernel/types.h"
#include "kernel/param.h"
#include "kernel/riscv.h"
#include "kernel/spinlock.h"
#include "kernel/proc.h"
#define F(x) printf("\"" #x "\":%zu,",offsetof(struct proc,x))
int main(){printf("{\"size\":%zu,\"count\":%d,\"nofile\":%d,",sizeof(struct proc),NPROC,NOFILE);F(state);F(parent);F(chan);F(killed);F(xstate);F(pid);F(sz);F(pagetable);F(trapframe);F(ofile);printf("\"name\":%zu}",offsetof(struct proc,name));}
